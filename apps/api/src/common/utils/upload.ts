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
  dokumen: ["pdf", "docx", "zip", "ole"],
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
export function validateUpload(buffer: Buffer, desired: "foto" | "dokumen" | "video", maxBytes: number): string {
  if (buffer.length > maxBytes) {
    throw new BadRequestException(`Ukuran file melebihi batas ${(maxBytes / 1024 / 1024).toFixed(0)} MB`);
  }
  const sniffed = sniffFile(buffer);
  if (!sniffed) throw new BadRequestException("Isi file bukan format yang dikenali");
  if (!ALLOWED[desired].includes(sniffed.ext)) {
    throw new BadRequestException(`File bukan kategori ${desired}`);
  }
  if (sniffed.ext === "zip") return "docx";
  if (sniffed.ext === "ole") return "doc";
  return sniffed.ext;
}
