import { createReadStream } from "node:fs";
import { access, constants, mkdir, readFile, readdir, stat, statfs, unlink, writeFile, copyFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { Readable } from "node:stream";
import {
  CapabilityNotSupportedError,
  StorageError,
  cleanKey,
  type AdapterCaps,
  type BrowseEntry,
  type HealthResult,
  type StorageAdapter,
  type StorageObjectInfo,
} from "./types.js";

/**
 * Adapter filesystem. Dipakai untuk provider LOCAL (folder uploads) dan NAS yang sudah di-mount di server
 * (SMB/NFS di-mount oleh OS; backend mengakses lewat path mount — tidak pernah dari browser).
 * `roots[0]` = lokasi tulis; root lain hanya untuk membaca (kompatibilitas path lama).
 */
export class LocalFsAdapter implements StorageAdapter {
  constructor(
    readonly code: "local" | "nas_mount",
    private readonly roots: string[],
  ) {}

  capabilities(): AdapterCaps {
    return {
      maxFileSize: null,
      multipart: false,
      streaming: true,
      signedUrl: false,
      checksum: true,
      versioning: false,
      renameMove: true,
      delete: true,
      capacity: true,
      retry: "Tanpa retry bawaan; job migrasi mengulang dengan exponential backoff",
    };
  }

  private abs(root: string, key: string): string {
    const base = resolve(root);
    const full = resolve(base, cleanKey(key));
    if (full !== base && !full.startsWith(base + sep)) throw new StorageError("Path di luar folder penyimpanan", "FORBIDDEN");
    return full;
  }

  private async findExisting(key: string): Promise<string | null> {
    for (const root of this.roots) {
      const p = this.abs(root, key);
      try {
        await access(p, constants.R_OK);
        return p;
      } catch {
        /* coba root berikutnya */
      }
    }
    return null;
  }

  async upload(key: string, data: Buffer): Promise<{ externalFileId?: string }> {
    const p = this.abs(this.roots[0]!, key);
    try {
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, data);
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === "ENOSPC") throw new StorageError("Penyimpanan penuh (tidak ada ruang tersisa)", "QUOTA");
      if (err.code === "EACCES" || err.code === "EPERM") throw new StorageError("Tidak punya izin menulis ke folder penyimpanan", "FORBIDDEN");
      throw new StorageError(`Gagal menulis file: ${err.message}`);
    }
    return {};
  }

  async download(key: string): Promise<Buffer> {
    const p = await this.findExisting(key);
    if (!p) throw new StorageError("Berkas tidak ada di penyimpanan", "NOT_FOUND");
    return readFile(p);
  }

  async downloadStream(key: string): Promise<Readable> {
    const p = await this.findExisting(key);
    if (!p) throw new StorageError("Berkas tidak ada di penyimpanan", "NOT_FOUND");
    return createReadStream(p);
  }

  async delete(key: string): Promise<void> {
    for (const root of this.roots) {
      try {
        await unlink(this.abs(root, key));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw new StorageError(`Gagal menghapus file: ${(e as Error).message}`);
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    return (await this.findExisting(key)) !== null;
  }

  async getMetadata(key: string): Promise<StorageObjectInfo | null> {
    const p = await this.findExisting(key);
    if (!p) return null;
    const s = await stat(p);
    return { key: cleanKey(key), size: s.size, modifiedAt: s.mtime };
  }

  async copy(sourceKey: string, targetKey: string): Promise<void> {
    const src = await this.findExisting(sourceKey);
    if (!src) throw new StorageError("Berkas sumber tidak ada", "NOT_FOUND");
    const dst = this.abs(this.roots[0]!, targetKey);
    await mkdir(dirname(dst), { recursive: true });
    await copyFile(src, dst);
  }

  async list(prefix: string): Promise<BrowseEntry[]> {
    const dir = this.abs(this.roots[0]!, prefix);
    let names: string[];
    try {
      names = await readdir(dir);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw new StorageError(`Gagal membaca folder: ${(e as Error).message}`);
    }
    const base = cleanKey(prefix);
    const out: BrowseEntry[] = [];
    for (const name of names.slice(0, 2000)) {
      try {
        const s = await stat(join(dir, name));
        out.push({
          name,
          path: base ? `${base}/${name}` : name,
          type: s.isDirectory() ? "dir" : "file",
          size: s.isDirectory() ? undefined : s.size,
          modifiedAt: s.mtime.toISOString(),
        });
      } catch {
        /* abaikan entri rusak */
      }
    }
    return out.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
  }

  async healthCheck(): Promise<HealthResult> {
    const t0 = Date.now();
    const root = this.roots[0]!;
    try {
      await mkdir(root, { recursive: true });
      await access(root, constants.R_OK | constants.W_OK);
      const sfs = await statfs(root);
      const total = Number(sfs.blocks) * Number(sfs.bsize);
      const free = Number(sfs.bavail) * Number(sfs.bsize);
      return { ok: true, latencyMs: Date.now() - t0, capacity: { total, free, used: Math.max(0, total - free) } };
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      const msg =
        err.code === "ENOENT"
          ? "Folder tidak ditemukan / NAS belum ter-mount di server"
          : err.code === "EACCES" || err.code === "EPERM"
            ? "Tidak punya izin baca/tulis ke folder ini"
            : err.message;
      return { ok: false, message: msg, latencyMs: Date.now() - t0 };
    }
  }

  async generateSignedUrl(): Promise<string> {
    throw new CapabilityNotSupportedError("signed URL");
  }
}
