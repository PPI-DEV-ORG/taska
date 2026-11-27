import { Platform } from "react-native";

function uint8ToBase64(bytes: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    out += chars[(triple >> 18) & 63];
    out += chars[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? chars[(triple >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? chars[triple & 63] : "=";
  }
  return out;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

async function shareUri(uri: string, mimeType?: string, dialogTitle?: string): Promise<boolean> {
  const Sharing = await import("expo-sharing");
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, {
    mimeType,
    dialogTitle: dialogTitle || "Simpan atau Bagikan Berkas",
  });
  return true;
}

/** Unduh file dari URL API ke cache perangkat native lalu buka Share Sheet (simpan / kirim WA). */
export async function downloadAndShareUrl(
  url: string,
  filename: string,
  headers?: Record<string, string>,
  mimeType?: string,
): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const FileSystem = await import("expo-file-system/legacy");
  const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!dir) return false;
  const target = `${dir}${sanitizeFilename(filename)}`;
  const res = await FileSystem.downloadAsync(url, target, headers ? { headers } : undefined);
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Gagal mengunduh berkas (HTTP ${res.status})`);
  }
  return shareUri(res.uri, mimeType, filename);
}

/** Simpan konten teks (CSV/HTML/DOC) ke cache perangkat native lalu buka Share Sheet. */
export async function saveAndShareTextFile(
  content: string,
  filename: string,
  mimeType = "text/csv",
): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const FileSystem = await import("expo-file-system/legacy");
  const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!dir) return false;
  const target = `${dir}${sanitizeFilename(filename)}`;
  await FileSystem.writeAsStringAsync(target, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return shareUri(target, mimeType, filename);
}

/** Simpan binary bytes (PDF/XLSX) ke cache perangkat native lalu buka Share Sheet. */
export async function saveAndShareBytesFile(
  bytes: Uint8Array,
  filename: string,
  mimeType = "application/pdf",
): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const FileSystem = await import("expo-file-system/legacy");
  const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!dir) return false;
  const target = `${dir}${sanitizeFilename(filename)}`;
  await FileSystem.writeAsStringAsync(target, uint8ToBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return shareUri(target, mimeType, filename);
}
