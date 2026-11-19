import { createHash, createHmac } from "node:crypto";
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

export type S3Config = {
  endpoint?: string; // kosong = AWS S3 resmi
  region?: string;
  bucket: string;
  prefix?: string;
  pathStyle?: boolean; // default true bila endpoint custom (MinIO/R2)
};
export type S3Secret = { accessKeyId: string; secretAccessKey: string };

const sha256Hex = (d: string | Buffer) => createHash("sha256").update(d).digest("hex");
const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data).digest();
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const xmlDecode = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/**
 * Adapter S3-compatible (AWS S3, Cloudflare R2, MinIO, dsb) memakai AWS Signature V4 murni
 * (node:crypto + fetch) — tanpa dependensi SDK. File dikirim lewat backend; kredensial tidak pernah ke browser.
 */
export class S3Adapter implements StorageAdapter {
  readonly code = "s3";
  private readonly region: string;
  private readonly prefix: string;
  private readonly pathStyle: boolean;
  private readonly endpoint: URL;

  constructor(
    private readonly cfg: S3Config,
    private readonly secret: S3Secret,
  ) {
    if (!cfg.bucket?.trim()) throw new StorageError("Nama bucket wajib diisi", "CONFIG");
    if (!secret?.accessKeyId || !secret?.secretAccessKey) throw new StorageError("Access key & secret key wajib diisi", "CONFIG");
    this.region = cfg.region?.trim() || (cfg.endpoint ? "auto" : "us-east-1");
    this.prefix = cleanKey(cfg.prefix ?? "");
    const custom = Boolean(cfg.endpoint?.trim());
    this.pathStyle = cfg.pathStyle ?? custom;
    try {
      this.endpoint = new URL(custom ? cfg.endpoint!.trim() : `https://s3.${this.region}.amazonaws.com`);
    } catch {
      throw new StorageError("Endpoint URL tidak valid (contoh: https://minio.perusahaan.com:9000)", "CONFIG");
    }
  }

  capabilities(): AdapterCaps {
    return {
      maxFileSize: 5 * 1024 * 1024 * 1024,
      multipart: false,
      streaming: false,
      signedUrl: false,
      checksum: false,
      versioning: false,
      renameMove: false,
      delete: true,
      capacity: false,
      retry: "Retry oleh job migrasi (exponential backoff)",
    };
  }

  private fullKey(key: string): string {
    return joinKey(this.prefix, key);
  }

  private urlFor(fullKey: string, query: Record<string, string> = {}): { url: string; host: string; canonicalUri: string; canonicalQuery: string } {
    const bucketHostStyle = !this.pathStyle;
    const host = bucketHostStyle ? `${this.cfg.bucket}.${this.endpoint.host}` : this.endpoint.host;
    const basePath = this.endpoint.pathname.replace(/\/+$/, "");
    const segs = fullKey ? fullKey.split("/").map(enc).join("/") : "";
    const canonicalUri = bucketHostStyle
      ? `${basePath}/${segs}` || "/"
      : `${basePath}/${enc(this.cfg.bucket)}${segs ? `/${segs}` : ""}`;
    const canonicalQuery = Object.keys(query)
      .sort()
      .map((k) => `${enc(k)}=${enc(query[k]!)}`)
      .join("&");
    const url = `${this.endpoint.protocol}//${host}${canonicalUri}${canonicalQuery ? `?${canonicalQuery}` : ""}`;
    return { url, host, canonicalUri, canonicalQuery };
  }

  private async request(
    method: string,
    fullKey: string,
    opts: { query?: Record<string, string>; body?: Buffer; headers?: Record<string, string>; timeoutMs?: number } = {},
  ): Promise<Response> {
    const { url, host, canonicalUri, canonicalQuery } = this.urlFor(fullKey, opts.query);
    const body = opts.body;
    const payloadHash = sha256Hex(body ?? "");
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);

    const headers: Record<string, string> = {
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      ...Object.fromEntries(Object.entries(opts.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v.trim()])),
    };
    const names = Object.keys(headers).sort();
    const canonicalHeaders = names.map((n) => `${n}:${headers[n]}\n`).join("");
    const signedHeaders = names.join(";");
    const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const scope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
    const kDate = hmac(`AWS4${this.secret.secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, this.region);
    const kService = hmac(kRegion, "s3");
    const kSigning = hmac(kService, "aws4_request");
    const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${this.secret.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    delete (headers as Record<string, string | undefined>).host; // fetch mengisi host sendiri

    try {
      return await fetch(url, {
        method,
        headers,
        body: body ? new Uint8Array(body) : undefined,
        signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000 + Math.ceil((body?.length ?? 0) / (256 * 1024)) * 1000),
      });
    } catch (e) {
      const err = e as Error & { cause?: { code?: string } };
      const code = err.cause?.code;
      if (err.name === "TimeoutError" || err.name === "AbortError") throw new StorageError("Koneksi ke storage timeout", "UNREACHABLE");
      if (code === "ENOTFOUND") throw new StorageError("Host storage tidak ditemukan (periksa URL/endpoint)", "UNREACHABLE");
      if (code === "ECONNREFUSED") throw new StorageError("Koneksi ditolak oleh server storage (periksa host & port)", "UNREACHABLE");
      throw new StorageError(`Tidak dapat terhubung ke storage: ${err.message}${code ? ` (${code})` : ""}`, "UNREACHABLE");
    }
  }

  private async fail(res: Response, what: string): Promise<never> {
    let code = "";
    try {
      const txt = await res.text();
      code = /<Code>([^<]+)<\/Code>/.exec(txt)?.[1] ?? "";
    } catch {
      /* abaikan */
    }
    if (res.status === 401 || res.status === 403 || /AccessDenied|InvalidAccessKeyId|SignatureDoesNotMatch/.test(code)) {
      if (code === "SignatureDoesNotMatch") throw new StorageError("Secret key salah atau region tidak cocok", "AUTH");
      if (code === "InvalidAccessKeyId") throw new StorageError("Access key tidak dikenal", "AUTH");
      throw new StorageError(`Akses ditolak saat ${what} (periksa credential & izin bucket)`, "AUTH");
    }
    if (res.status === 404 || code === "NoSuchBucket") {
      if (code === "NoSuchBucket") throw new StorageError(`Bucket "${this.cfg.bucket}" tidak ditemukan`, "CONFIG");
      throw new StorageError("Berkas tidak ada di penyimpanan", "NOT_FOUND");
    }
    if (res.status === 507 || /QuotaExceeded|EntityTooLarge/.test(code)) throw new StorageError("Kuota storage penuh / file terlalu besar", "QUOTA");
    throw new StorageError(`Storage menolak permintaan (${res.status}${code ? ` ${code}` : ""}) saat ${what}`);
  }

  async upload(key: string, data: Buffer, opts?: { mimeType?: string }): Promise<{ externalFileId?: string }> {
    const res = await this.request("PUT", this.fullKey(key), {
      body: data,
      headers: { "content-type": opts?.mimeType ?? "application/octet-stream" },
    });
    if (!res.ok) await this.fail(res, "mengunggah file");
    return { externalFileId: res.headers.get("etag")?.replace(/"/g, "") ?? undefined };
  }

  async download(key: string): Promise<Buffer> {
    const res = await this.request("GET", this.fullKey(key));
    if (!res.ok) await this.fail(res, "mengunduh file");
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const res = await this.request("DELETE", this.fullKey(key));
    if (!res.ok && res.status !== 404) await this.fail(res, "menghapus file");
  }

  async exists(key: string): Promise<boolean> {
    return (await this.getMetadata(key)) !== null;
  }

  async getMetadata(key: string): Promise<StorageObjectInfo | null> {
    const res = await this.request("HEAD", this.fullKey(key));
    if (res.status === 404) return null;
    if (!res.ok) await this.fail(res, "membaca metadata");
    const lm = res.headers.get("last-modified");
    return {
      key: cleanKey(key),
      size: Number(res.headers.get("content-length") ?? 0),
      etag: res.headers.get("etag")?.replace(/"/g, "") ?? undefined,
      modifiedAt: lm ? new Date(lm) : undefined,
    };
  }

  async copy(sourceKey: string, targetKey: string): Promise<void> {
    const src = `/${enc(this.cfg.bucket)}/${this.fullKey(sourceKey).split("/").map(enc).join("/")}`;
    const res = await this.request("PUT", this.fullKey(targetKey), { headers: { "x-amz-copy-source": src } });
    if (!res.ok) await this.fail(res, "menyalin file");
  }

  async list(prefix: string): Promise<BrowseEntry[]> {
    const pfx = joinKey(this.prefix, prefix);
    const out: BrowseEntry[] = [];
    let token: string | undefined;
    for (let page = 0; page < 5; page++) {
      const query: Record<string, string> = { "list-type": "2", delimiter: "/", "max-keys": "1000" };
      if (pfx) query.prefix = `${pfx}/`;
      if (token) query["continuation-token"] = token;
      const res = await this.request("GET", "", { query });
      if (!res.ok) await this.fail(res, "membaca isi bucket");
      const xml = await res.text();
      const strip = (full: string) => (this.prefix ? full.slice(this.prefix.length).replace(/^\//, "") : full);
      for (const m of xml.matchAll(/<CommonPrefixes>\s*<Prefix>([^<]*)<\/Prefix>/g)) {
        const p = strip(xmlDecode(m[1]!)).replace(/\/$/, "");
        out.push({ name: p.split("/").pop() ?? p, path: p, type: "dir" });
      }
      for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
        const body = m[1]!;
        const k = xmlDecode(/<Key>([^<]*)<\/Key>/.exec(body)?.[1] ?? "");
        if (!k || k.endsWith("/")) continue;
        const p = strip(k);
        out.push({
          name: p.split("/").pop() ?? p,
          path: p,
          type: "file",
          size: Number(/<Size>(\d+)<\/Size>/.exec(body)?.[1] ?? 0),
          modifiedAt: /<LastModified>([^<]*)<\/LastModified>/.exec(body)?.[1],
        });
      }
      const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
      token = /<NextContinuationToken>([^<]*)<\/NextContinuationToken>/.exec(xml)?.[1];
      if (!truncated || !token) break;
    }
    return out.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
  }

  async healthCheck(): Promise<HealthResult> {
    const t0 = Date.now();
    try {
      const res = await this.request("GET", "", { query: { "list-type": "2", "max-keys": "1" }, timeoutMs: 15_000 });
      if (!res.ok) await this.fail(res, "memeriksa bucket");
      await res.arrayBuffer();
      return { ok: true, latencyMs: Date.now() - t0 }; // S3 tidak punya kuota; tampilkan jumlah file dari database
    } catch (e) {
      return { ok: false, message: (e as Error).message, latencyMs: Date.now() - t0 };
    }
  }

  async generateSignedUrl(): Promise<string> {
    // Sengaja tidak diaktifkan: semua akses file lewat backend + pemeriksaan permission.
    throw new StorageError("Signed URL tidak diaktifkan; unduhan selalu melalui backend", "CONFIG");
  }
}
