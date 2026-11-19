import {
  StorageError,
  cleanKey,
  joinKey,
  type AdapterCaps,
  type BrowseEntry,
  type HealthResult,
  type StorageAdapter,
  type StorageObjectInfo,
} from "./types.js";

export type WebDavConfig = { url: string; prefix?: string };
export type WebDavSecret = { username: string; password: string };

const xmlDecode = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** Adapter WebDAV (Synology/QNAP/Nextcloud/…); NAS diakses oleh backend, bukan browser. */
export class WebDavAdapter implements StorageAdapter {
  readonly code = "webdav";
  private readonly base: URL;
  private readonly prefix: string;
  private readonly auth: string;

  constructor(cfg: WebDavConfig, secret: WebDavSecret) {
    if (!cfg.url?.trim()) throw new StorageError("URL WebDAV wajib diisi", "CONFIG");
    try {
      this.base = new URL(cfg.url.trim());
    } catch {
      throw new StorageError("URL WebDAV tidak valid (contoh: https://nas.perusahaan.com:5006/akuntra)", "CONFIG");
    }
    if (!/^https?:$/.test(this.base.protocol)) throw new StorageError("URL WebDAV harus diawali http:// atau https://", "CONFIG");
    this.prefix = cleanKey(cfg.prefix ?? "");
    this.auth = `Basic ${Buffer.from(`${secret?.username ?? ""}:${secret?.password ?? ""}`).toString("base64")}`;
  }

  capabilities(): AdapterCaps {
    return {
      maxFileSize: null,
      multipart: false,
      streaming: false,
      signedUrl: false,
      checksum: false,
      versioning: false,
      renameMove: true,
      delete: true,
      capacity: true,
      retry: "Retry oleh job migrasi (exponential backoff)",
    };
  }

  private urlOf(key: string): string {
    const full = joinKey(this.prefix, key);
    const segs = full ? full.split("/").map(encodeURIComponent).join("/") : "";
    const basePath = this.base.pathname.replace(/\/+$/, "");
    return `${this.base.origin}${basePath}${segs ? `/${segs}` : ""}`;
  }

  private async req(method: string, url: string, init: { body?: Buffer; headers?: Record<string, string>; timeoutMs?: number } = {}): Promise<Response> {
    try {
      return await fetch(url, {
        method,
        headers: { authorization: this.auth, ...(init.headers ?? {}) },
        body: init.body ? new Uint8Array(init.body) : undefined,
        signal: AbortSignal.timeout(init.timeoutMs ?? 30_000 + Math.ceil((init.body?.length ?? 0) / (256 * 1024)) * 1000),
      });
    } catch (e) {
      const err = e as Error & { cause?: { code?: string } };
      const code = err.cause?.code;
      if (err.name === "TimeoutError" || err.name === "AbortError") throw new StorageError("Koneksi ke NAS timeout", "UNREACHABLE");
      if (code === "ENOTFOUND") throw new StorageError("Host NAS tidak ditemukan (periksa URL)", "UNREACHABLE");
      if (code === "ECONNREFUSED") throw new StorageError("Koneksi ditolak NAS (periksa host & port)", "UNREACHABLE");
      throw new StorageError(`Tidak dapat terhubung ke NAS: ${err.message}${code ? ` (${code})` : ""}`, "UNREACHABLE");
    }
  }

  private check(res: Response, what: string): void {
    if (res.ok || res.status === 207) return;
    if (res.status === 401) throw new StorageError("Username/password NAS salah", "AUTH");
    if (res.status === 403) throw new StorageError(`Akses ditolak saat ${what} (periksa izin folder)`, "AUTH");
    if (res.status === 404) throw new StorageError("Berkas/folder tidak ditemukan", "NOT_FOUND");
    if (res.status === 507) throw new StorageError("Kuota NAS penuh", "QUOTA");
    throw new StorageError(`NAS menolak permintaan (${res.status}) saat ${what}`);
  }

  /** Buat folder bertingkat (MKCOL), abaikan jika sudah ada (405). */
  private async ensureDirs(key: string): Promise<void> {
    const full = joinKey(this.prefix, key);
    const parts = full.split("/");
    parts.pop(); // buang nama file
    let acc = "";
    const basePath = this.base.pathname.replace(/\/+$/, "");
    for (const p of parts) {
      acc = acc ? `${acc}/${p}` : p;
      const url = `${this.base.origin}${basePath}/${acc.split("/").map(encodeURIComponent).join("/")}`;
      const res = await this.req("MKCOL", url);
      if (!res.ok && res.status !== 405 && res.status !== 301) {
        if (res.status === 401) throw new StorageError("Username/password NAS salah", "AUTH");
        if (res.status === 403) throw new StorageError("Akses ditolak saat membuat folder di NAS", "AUTH");
        if (res.status === 507) throw new StorageError("Kuota NAS penuh", "QUOTA");
      }
    }
  }

  async upload(key: string, data: Buffer, opts?: { mimeType?: string }): Promise<{ externalFileId?: string }> {
    await this.ensureDirs(key);
    const res = await this.req("PUT", this.urlOf(key), { body: data, headers: { "content-type": opts?.mimeType ?? "application/octet-stream" } });
    this.check(res, "mengunggah file");
    return {};
  }

  async download(key: string): Promise<Buffer> {
    const res = await this.req("GET", this.urlOf(key));
    this.check(res, "mengunduh file");
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const res = await this.req("DELETE", this.urlOf(key));
    if (res.status === 404) return;
    this.check(res, "menghapus file");
  }

  async exists(key: string): Promise<boolean> {
    return (await this.getMetadata(key)) !== null;
  }

  async getMetadata(key: string): Promise<StorageObjectInfo | null> {
    const res = await this.req("HEAD", this.urlOf(key));
    if (res.status === 404) return null;
    this.check(res, "membaca metadata");
    const lm = res.headers.get("last-modified");
    return {
      key: cleanKey(key),
      size: Number(res.headers.get("content-length") ?? 0),
      etag: res.headers.get("etag")?.replace(/"/g, "") ?? undefined,
      modifiedAt: lm ? new Date(lm) : undefined,
    };
  }

  async copy(sourceKey: string, targetKey: string): Promise<void> {
    await this.ensureDirs(targetKey);
    const res = await this.req("COPY", this.urlOf(sourceKey), { headers: { destination: this.urlOf(targetKey), overwrite: "T" } });
    this.check(res, "menyalin file");
  }

  async list(prefix: string): Promise<BrowseEntry[]> {
    const res = await this.req("PROPFIND", this.urlOf(prefix), {
      headers: { depth: "1", "content-type": "application/xml" },
      body: Buffer.from('<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getcontentlength/><d:getlastmodified/><d:resourcetype/></d:prop></d:propfind>'),
    });
    if (res.status === 404) return [];
    this.check(res, "membaca isi folder");
    const xml = await res.text();
    const basePath = decodeURIComponent(this.base.pathname.replace(/\/+$/, ""));
    const here = joinKey(basePath, this.prefix, prefix);
    const out: BrowseEntry[] = [];
    for (const m of xml.matchAll(/<(?:\w+:)?response>([\s\S]*?)<\/(?:\w+:)?response>/g)) {
      const body = m[1]!;
      const href = xmlDecode(/<(?:\w+:)?href>([^<]*)<\/(?:\w+:)?href>/.exec(body)?.[1] ?? "");
      let pathname = href;
      try {
        pathname = decodeURIComponent(new URL(href, this.base.origin).pathname);
      } catch {
        /* pakai href apa adanya */
      }
      const clean = pathname.replace(/\/+$/, "").replace(/^\/+/, "");
      if (!clean || clean === here) continue;
      const isDir = /<(?:\w+:)?collection\s*\/?>/.test(body);
      const rel = clean.startsWith(joinKey(basePath, this.prefix)) ? clean.slice(joinKey(basePath, this.prefix).length).replace(/^\//, "") : clean;
      out.push({
        name: rel.split("/").pop() ?? rel,
        path: rel,
        type: isDir ? "dir" : "file",
        size: isDir ? undefined : Number(/<(?:\w+:)?getcontentlength>(\d+)</.exec(body)?.[1] ?? 0),
        modifiedAt: /<(?:\w+:)?getlastmodified>([^<]*)</.exec(body)?.[1],
      });
    }
    return out.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
  }

  async healthCheck(): Promise<HealthResult> {
    const t0 = Date.now();
    try {
      const res = await this.req("PROPFIND", this.urlOf(""), {
        headers: { depth: "0", "content-type": "application/xml" },
        body: Buffer.from('<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:quota-available-bytes/><d:quota-used-bytes/></d:prop></d:propfind>'),
        timeoutMs: 15_000,
      });
      if (res.status === 404) {
        // folder dasar belum ada → coba buat
        await this.ensureDirs(`${"x"}/y`.replace("x/y", "") + "_");
      } else this.check(res, "memeriksa NAS");
      const xml = res.status === 404 ? "" : await res.text();
      const avail = /quota-available-bytes[^>]*>(\d+)</.exec(xml)?.[1];
      const used = /quota-used-bytes[^>]*>(\d+)</.exec(xml)?.[1];
      const capacity = avail || used ? { free: avail ? Number(avail) : undefined, used: used ? Number(used) : undefined, total: avail && used ? Number(avail) + Number(used) : undefined } : undefined;
      return { ok: true, latencyMs: Date.now() - t0, capacity };
    } catch (e) {
      return { ok: false, message: (e as Error).message, latencyMs: Date.now() - t0 };
    }
  }

  async generateSignedUrl(): Promise<string> {
    throw new StorageError("Signed URL tidak diaktifkan; unduhan selalu melalui backend", "CONFIG");
  }
}
