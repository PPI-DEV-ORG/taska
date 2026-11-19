import type { Readable } from "node:stream";

export type AdapterCaps = {
  maxFileSize: number | null;
  multipart: boolean;
  streaming: boolean;
  signedUrl: boolean;
  checksum: boolean;
  versioning: boolean;
  renameMove: boolean;
  delete: boolean;
  capacity: boolean;
  retry: string;
};

export type StorageObjectInfo = {
  key: string;
  size: number;
  etag?: string;
  modifiedAt?: Date;
};

export type BrowseEntry = {
  name: string;
  path: string;
  type: "dir" | "file";
  size?: number;
  modifiedAt?: string;
};

export type HealthResult = {
  ok: boolean;
  message?: string;
  latencyMs: number;
  capacity?: { total?: number; used?: number; free?: number };
};

export class CapabilityNotSupportedError extends Error {
  constructor(what: string) {
    super(`Fitur "${what}" tidak didukung oleh provider ini`);
    this.name = "CapabilityNotSupportedError";
  }
}

/** Kegagalan terstruktur dari adapter (pesan sudah ramah pengguna). */
export class StorageError extends Error {
  constructor(
    message: string,
    readonly code: "UNREACHABLE" | "AUTH" | "NOT_FOUND" | "FORBIDDEN" | "QUOTA" | "CONFIG" | "UNKNOWN" = "UNKNOWN",
  ) {
    super(message);
    this.name = "StorageError";
  }
}

/**
 * Kontrak seragam semua storage provider (PRD §10).
 * Method yang tidak didukung WAJIB melempar CapabilityNotSupportedError, bukan pura-pura berhasil.
 */
export interface StorageAdapter {
  readonly code: string;
  capabilities(): AdapterCaps;
  upload(key: string, data: Buffer, opts?: { mimeType?: string }): Promise<{ externalFileId?: string }>;
  download(key: string): Promise<Buffer>;
  downloadStream?(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getMetadata(key: string): Promise<StorageObjectInfo | null>;
  copy(sourceKey: string, targetKey: string): Promise<void>;
  /** Daftar isi satu level folder (prefix). */
  list(prefix: string): Promise<BrowseEntry[]>;
  healthCheck(): Promise<HealthResult>;
  generateSignedUrl(key: string, expiresInSec: number): Promise<string>;
}

/** Normalisasi key: tanpa awalan "/", tanpa ".." (cegah path traversal). */
export function cleanKey(key: string): string {
  const parts = String(key ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .filter((p) => p && p !== ".");
  if (parts.some((p) => p === "..")) throw new StorageError("Path tidak valid", "CONFIG");
  return parts.join("/");
}

export function joinKey(...parts: Array<string | undefined>): string {
  return parts
    .map((p) => cleanKey(p ?? ""))
    .filter(Boolean)
    .join("/");
}
