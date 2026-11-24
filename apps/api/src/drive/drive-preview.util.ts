import { inflateRawSync } from "node:zlib";
import ExcelJS from "exceljs";

export type DrivePreviewSheet = {
  name: string;
  rows: string[][];
  totalRows: number;
  truncated: boolean;
};

export type DriveDocxBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "table"; rows: string[][] };

export type DrivePreviewResult =
  | { kind: "image"; mimeType: string; fileName: string; size: number }
  | { kind: "pdf"; mimeType: string; fileName: string; size: number }
  | { kind: "video"; mimeType: string; fileName: string; size: number }
  | { kind: "audio"; mimeType: string; fileName: string; size: number }
  | { kind: "text"; mimeType: string; fileName: string; size: number; content: string; truncated: boolean }
  | { kind: "spreadsheet"; mimeType: string; fileName: string; size: number; sheets: DrivePreviewSheet[] }
  | { kind: "docx"; mimeType: string; fileName: string; size: number; blocks: DriveDocxBlock[] }
  | { kind: "unsupported"; mimeType: string; fileName: string; size: number; reason: string };

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico"]);
const VIDEO_EXTS = new Set(["mp4", "webm", "mov", "mkv", "m4v"]);
const AUDIO_EXTS = new Set(["mp3", "wav", "ogg", "m4a", "aac", "flac"]);
const TEXT_EXTS = new Set([
  "txt", "md", "markdown", "json", "xml", "log", "yml", "yaml",
  "ini", "cfg", "conf", "sql", "js", "ts", "tsx", "jsx", "css",
  "html", "htm", "sh", "bat", "env", "properties",
]);
const EXCEL_EXTS = new Set(["xlsx", "xlsm"]);
const CSV_EXTS = new Set(["csv", "tsv"]);

export function getExtension(fileName: string, explicitExt?: string | null): string {
  const fromExplicit = (explicitExt || "").replace(/^\./, "").trim().toLowerCase();
  if (fromExplicit) return fromExplicit;
  const idx = fileName.lastIndexOf(".");
  if (idx <= 0 || idx === fileName.length - 1) return "";
  return fileName.slice(idx + 1).toLowerCase();
}

export function classifyFileType(ext: string, mimeType: string): string {
  const e = ext.toLowerCase();
  const m = (mimeType || "").toLowerCase();
  if (e === "pdf" || m === "application/pdf") return "pdf";
  if (EXCEL_EXTS.has(e) || e === "xls" || CSV_EXTS.has(e) || m.includes("spreadsheet") || m.includes("excel")) return "excel";
  if (e === "docx" || e === "doc" || m.includes("wordprocessingml") || m.includes("msword")) return "word";
  if (IMAGE_EXTS.has(e) || m.startsWith("image/")) return "image";
  if (VIDEO_EXTS.has(e) || m.startsWith("video/")) return "video";
  if (AUDIO_EXTS.has(e) || m.startsWith("audio/")) return "audio";
  if (TEXT_EXTS.has(e) || m.startsWith("text/") || m === "application/json") return "text";
  return "other";
}

function formatExcelCellValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === "object") {
    const obj = val as Record<string, any>;
    if (obj.result !== undefined && obj.result !== null) {
      return formatExcelCellValue(obj.result);
    }
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((r: any) => r?.text ?? "").join("");
    }
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.hyperlink === "string") return obj.text || obj.hyperlink;
    if (obj.error) return String(obj.error);
  }
  return String(val);
}

async function parseXlsxPreview(buffer: Buffer): Promise<DrivePreviewSheet[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);

  const MAX_SHEETS = 10;
  const MAX_ROWS = 200;
  const MAX_COLS = 30;

  const sheets: DrivePreviewSheet[] = [];
  for (const ws of wb.worksheets.slice(0, MAX_SHEETS)) {
    const rows: string[][] = [];
    const totalRows = ws.rowCount || 0;
    const colCount = Math.min(MAX_COLS, Math.max(ws.columnCount || 0, 1));

    ws.eachRow({ includeEmpty: false }, (row) => {
      if (rows.length >= MAX_ROWS) return;
      const arr: string[] = [];
      for (let c = 1; c <= colCount; c++) {
        arr.push(formatExcelCellValue(row.getCell(c).value));
      }
      // Trim trailing empty cells
      while (arr.length > 1 && arr[arr.length - 1] === "") {
        arr.pop();
      }
      rows.push(arr);
    });

    sheets.push({
      name: ws.name || `Sheet ${sheets.length + 1}`,
      rows,
      totalRows,
      truncated: totalRows > MAX_ROWS,
    });
  }
  return sheets;
}

function parseCsvPreview(buffer: Buffer, isTsv: boolean): DrivePreviewSheet[] {
  const MAX_ROWS = 250;
  const MAX_COLS = 30;
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const sep = isTsv ? "\t" : ",";
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows: string[][] = [];

  for (const line of lines.slice(0, MAX_ROWS)) {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === sep && !inQuotes) {
        cells.push(cur.trim());
        cur = "";
        if (cells.length >= MAX_COLS) break;
      } else {
        cur += ch;
      }
    }
    if (cells.length < MAX_COLS) cells.push(cur.trim());
    rows.push(cells);
  }

  return [
    {
      name: isTsv ? "TSV" : "CSV",
      rows,
      totalRows: lines.length,
      truncated: lines.length > MAX_ROWS,
    },
  ];
}

/**
 * Pure Node.js ZIP entry extractor for DOCX (`word/document.xml`).
 * Supports stored (method 0) and deflate (method 8) ZIP entries without external deps.
 */
function extractZipEntry(zip: Buffer, targetPath: string): Buffer | null {
  // Locate End of Central Directory (EOCD) signature 0x06054b50
  const maxComment = Math.min(zip.length, 65557);
  let eocdOffset = -1;
  for (let i = zip.length - 22; i >= zip.length - maxComment && i >= 0; i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) return null;

  const cdCount = zip.readUInt16LE(eocdOffset + 10);
  const cdOffset = zip.readUInt32LE(eocdOffset + 16);

  let pos = cdOffset;
  for (let i = 0; i < cdCount && pos + 46 <= zip.length; i++) {
    if (zip.readUInt32LE(pos) !== 0x02014b50) break;
    const method = zip.readUInt16LE(pos + 10);
    const compSize = zip.readUInt32LE(pos + 20);
    const nameLen = zip.readUInt16LE(pos + 28);
    const extraLen = zip.readUInt16LE(pos + 30);
    const commentLen = zip.readUInt16LE(pos + 32);
    const localHeaderOffset = zip.readUInt32LE(pos + 42);
    const entryName = zip.subarray(pos + 46, pos + 46 + nameLen).toString("utf8");

    if (entryName === targetPath) {
      if (localHeaderOffset + 30 > zip.length) return null;
      if (zip.readUInt32LE(localHeaderOffset) !== 0x04034b50) return null;
      const localNameLen = zip.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = zip.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const compData = zip.subarray(dataStart, dataStart + compSize);
      if (method === 0) return compData;
      if (method === 8) return inflateRawSync(compData);
      return null;
    }

    pos += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function extractTextFromWordXml(xmlChunk: string): string {
  const parts: string[] = [];
  const tokenRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(xmlChunk)) !== null) {
    if (m[1] !== undefined) {
      parts.push(decodeXmlEntities(m[1]));
    } else if (m[0].startsWith("<w:tab")) {
      parts.push("\t");
    } else {
      parts.push("\n");
    }
  }
  return parts.join("").trim();
}

function parseDocxPreview(buffer: Buffer): DriveDocxBlock[] {
  const docXmlBuf = extractZipEntry(buffer, "word/document.xml");
  if (!docXmlBuf) {
    throw new Error("Struktur file DOCX tidak valid (word/document.xml tidak ditemukan).");
  }
  const xml = docXmlBuf.toString("utf8");
  const bodyMatch = xml.match(/<w:body[^>]*>([\s\S]*?)<\/w:body>/);
  const body = bodyMatch ? bodyMatch[1]! : xml;

  const blocks: DriveDocxBlock[] = [];
  const MAX_BLOCKS = 300;

  // Match top-level tables and paragraphs in document order
  const blockRe = /<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(body)) !== null && blocks.length < MAX_BLOCKS) {
    const chunk = m[0];
    if (chunk.startsWith("<w:tbl")) {
      const rows: string[][] = [];
      const trRe = /<w:tr\b[\s\S]*?<\/w:tr>/g;
      let tr: RegExpExecArray | null;
      while ((tr = trRe.exec(chunk)) !== null && rows.length < 100) {
        const cells: string[] = [];
        const tcRe = /<w:tc\b[\s\S]*?<\/w:tc>/g;
        let tc: RegExpExecArray | null;
        while ((tc = tcRe.exec(tr[0])) !== null && cells.length < 20) {
          const pTexts: string[] = [];
          const pRe = /<w:p\b[\s\S]*?<\/w:p>/g;
          let p: RegExpExecArray | null;
          while ((p = pRe.exec(tc[0])) !== null) {
            const t = extractTextFromWordXml(p[0]);
            if (t) pTexts.push(t);
          }
          cells.push(pTexts.join("\n"));
        }
        if (cells.length > 0) rows.push(cells);
      }
      if (rows.length > 0) blocks.push({ type: "table", rows });
    } else {
      const text = extractTextFromWordXml(chunk);
      if (!text) continue;
      const styleMatch = chunk.match(/<w:pStyle\s+w:val="([^"]+)"/i);
      const styleVal = (styleMatch?.[1] || "").toLowerCase();
      if (styleVal.startsWith("heading") || styleVal === "title") {
        const lvl = styleVal === "title" ? 1 : Math.min(3, Math.max(1, Number(styleVal.replace(/\D/g, "")) || 2));
        blocks.push({ type: "heading", level: lvl, text });
      } else {
        blocks.push({ type: "paragraph", text });
      }
    }
  }

  return blocks;
}

export async function buildDrivePreview(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  explicitExt?: string | null,
): Promise<DrivePreviewResult> {
  const ext = getExtension(fileName, explicitExt);
  const size = buffer.length;
  const mt = mimeType || "application/octet-stream";

  if (IMAGE_EXTS.has(ext) || mt.startsWith("image/")) {
    return { kind: "image", mimeType: mt, fileName, size };
  }
  if (ext === "pdf" || mt === "application/pdf") {
    return { kind: "pdf", mimeType: "application/pdf", fileName, size };
  }
  if (VIDEO_EXTS.has(ext) || mt.startsWith("video/")) {
    return { kind: "video", mimeType: mt, fileName, size };
  }
  if (AUDIO_EXTS.has(ext) || mt.startsWith("audio/")) {
    return { kind: "audio", mimeType: mt, fileName, size };
  }
  if (EXCEL_EXTS.has(ext)) {
    try {
      const sheets = await parseXlsxPreview(buffer);
      return { kind: "spreadsheet", mimeType: mt, fileName, size, sheets };
    } catch (e) {
      return {
        kind: "unsupported",
        mimeType: mt,
        fileName,
        size,
        reason: `Gagal membaca file Excel: ${(e as Error).message}`,
      };
    }
  }
  if (CSV_EXTS.has(ext)) {
    const sheets = parseCsvPreview(buffer, ext === "tsv");
    return { kind: "spreadsheet", mimeType: mt, fileName, size, sheets };
  }
  if (ext === "docx") {
    try {
      const blocks = parseDocxPreview(buffer);
      return { kind: "docx", mimeType: mt, fileName, size, blocks };
    } catch (e) {
      return {
        kind: "unsupported",
        mimeType: mt,
        fileName,
        size,
        reason: `Gagal membaca file Word (.docx): ${(e as Error).message}`,
      };
    }
  }
  if (TEXT_EXTS.has(ext) || mt.startsWith("text/") || mt === "application/json") {
    const MAX_BYTES = 300 * 1024;
    const truncated = buffer.length > MAX_BYTES;
    const content = (truncated ? buffer.subarray(0, MAX_BYTES) : buffer).toString("utf8");
    return { kind: "text", mimeType: mt, fileName, size, content, truncated };
  }

  return {
    kind: "unsupported",
    mimeType: mt,
    fileName,
    size,
    reason: `Format .${ext || "unknown"} belum mendukung pratinjau langsung. Silakan unduh berkas untuk membukanya.`,
  };
}
