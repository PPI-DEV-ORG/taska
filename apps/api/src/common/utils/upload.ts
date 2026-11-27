import { BadRequestException } from "@nestjs/common";

/** Deteksi tipe file dari isi (magic bytes), bukan ekstensi. */
const SIGNATURES: Array<{ ext: string; kind: "foto" | "dokumen" | "video" | "lain"; test: (b: Buffer) => boolean }> = [
  { ext: "png", kind: "foto", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "jpg", kind: "foto", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "pdf", kind: "dokumen", test: (b) => b.subarray(0, 4).toString("latin1") === "%PDF" },
  { ext: "docx", kind: "dokumen", test: (b) => b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07) },
  { ext: "zip", kind: "dokumen", test: (b) => b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07) },
  { ext: "ole", kind: "dokumen", test: (b) => b.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) },
  { ext: "mp4", kind: "video", test: (b) => b.length > 12 && b.subarray(4, 8).toString("latin1") === "ftyp" },
  { ext: "mkv", kind: "video", test: (b) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) },
  { ext: "webp", kind: "foto", test: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
];

const ALLOWED: Record<"foto" | "dokumen" | "video", string[]> = {
  foto: ["png", "jpg", "webp"],
  dokumen: ["pdf", "docx", "doc", "zip", "ole", "png", "jpg", "webp", "md", "markdown", "txt", "xlsx", "xls", "csv"],
  video: ["mp4", "mkv"],
};

export function sniffFile(buffer: Buffer): { ext: string; kind: string } | null {
  for (const sig of SIGNATURES) {
    if (sig.test(buffer)) return { ext: sig.ext, kind: sig.kind };
  }
  return null;
}

/**
 * Validasi ukuran + tipe isi file (PRD #19).
 * @param desired "foto" | "dokumen" | "video" — kategori yang diminta endpoint.
 */
export function validateUpload(
  buffer: Buffer,
  desired: "foto" | "dokumen" | "video",
  maxBytes: number,
  originalName?: string,
): string {
  if (buffer.length > maxBytes) {
    throw new BadRequestException(`Ukuran file melebihi batas ${(maxBytes / 1024 / 1024).toFixed(0)} MB`);
  }

  // Khusus dokumen berbasis teks / markdown / csv
  if (desired === "dokumen" && originalName) {
    const lower = originalName.toLowerCase();
    if (lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".txt")) {
      const isPlainText = !buffer.subarray(0, Math.min(buffer.length, 1024)).includes(0x00);
      if (isPlainText) {
        return lower.endsWith(".txt") ? "txt" : "md";
      }
    }
    if (lower.endsWith(".csv")) {
      return "csv";
    }
  }

  const sniffed = sniffFile(buffer);
  if (!sniffed) {
    if (desired === "dokumen" && originalName) {
      const lower = originalName.toLowerCase();
      if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "md";
      if (lower.endsWith(".txt")) return "txt";
      if (lower.endsWith(".csv")) return "csv";
    }
    throw new BadRequestException("Isi file bukan format yang dikenali");
  }
  if (!ALLOWED[desired].includes(sniffed.ext)) {
    throw new BadRequestException(`File bukan kategori ${desired}`);
  }
  if (sniffed.ext === "zip") return "docx";
  if (sniffed.ext === "ole") return "doc";
  return sniffed.ext;
}

const SAFE_INLINE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "video/mp4",
]);

const BLOCKED_EXTENSIONS = new Set([
  "html",
  "htm",
  "xhtml",
  "svg",
  "svgz",
  "js",
  "mjs",
  "cjs",
  "jsx",
  "ts",
  "tsx",
  "php",
  "phtml",
  "exe",
  "dll",
  "bat",
  "cmd",
  "sh",
  "ps1",
  "vbs",
  "scr",
  "msi",
]);

const DANGEROUS_MIME_RE = /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|text\/javascript|application\/javascript|application\/x-javascript|application\/x-httpd-php|application\/x-msdownload)/i;

/** Apakah MIME aman ditampilkan inline di browser tanpa risiko Stored XSS. */
export function isSafeInlineMime(mimeType: string | null | undefined): boolean {
  const norm = (mimeType || "").split(";")[0]?.trim().toLowerCase() ?? "";
  return SAFE_INLINE_MIMES.has(norm);
}

/**
 * Validasi keamanan untuk upload umum (Drive / Replace File):
 * menolak ekstensi/MIME skrip berbahaya (HTML/SVG/JS/EXE) dan mengembalikan MIME aman.
 */
export function assertSafeUploadedFile(
  buffer: Buffer,
  originalName: string,
  clientMimeType?: string,
): string {
  const lowerName = (originalName || "").trim().toLowerCase();
  const ext = lowerName.includes(".") ? lowerName.split(".").pop() || "" : "";
  if (ext && BLOCKED_EXTENSIONS.has(ext)) {
    throw new BadRequestException(`Tipe berkas .${ext} tidak diizinkan demi keamanan.`);
  }
  const normalizedMime = (clientMimeType || "").split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
  if (DANGEROUS_MIME_RE.test(normalizedMime)) {
    throw new BadRequestException("Tipe MIME berkas tidak diizinkan demi keamanan.");
  }
  // Cek isi awal teks agar file HTML/SVG tidak menyamar dengan ekstensi lain
  const head = buffer.subarray(0, Math.min(buffer.length, 512)).toString("utf8").trimStart().toLowerCase();
  if (
    head.startsWith("<!doctype html") ||
    head.startsWith("<html") ||
    head.startsWith("<script") ||
    head.startsWith("<svg")
  ) {
    throw new BadRequestException("Konten HTML/SVG/skrip tidak diizinkan diunggah.");
  }
  return normalizedMime;
}
