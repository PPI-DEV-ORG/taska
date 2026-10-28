import * as SecureStore from "expo-secure-store";

const FALLBACK_BASE = "http://localhost:3030/api";

export function apiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL || "";
  let base = (fromEnv || FALLBACK_BASE).replace(/\/+$/, "");
  if (typeof window !== "undefined" && window.location?.hostname) {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      base = base.replace("://localhost", `://${host}`).replace("://127.0.0.1", `://${host}`);
    }
  }
  if (!base.endsWith("/api")) {
    base = `${base}/api`;
  }
  return base;
}

/** Origin (tanpa /api) untuk static assets /uploads dan socket.io. */
export function apiOrigin(): string {
  const b = apiBase();
  return b.endsWith("/api") ? b.slice(0, -4) : b;
}

const KEY_ACCESS = "taska_access";
const KEY_REFRESH = "taska_refresh";
const LEGACY_ROLE = "taska_role";

// ─── token storage ───
// native: expo-secure-store (persisten, aman). web: localStorage.
// akses sinkron dibaca dari memori yang sudah di-hydrate sekali di startup.

function isWeb(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

const memory = new Map<string, string>();
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

export function hydrateTokens(): Promise<void> {
  if (hydrated) return Promise.resolve();
  if (!hydratePromise) {
    hydratePromise = (async () => {
      if (isWeb()) {
        for (const k of [KEY_ACCESS, KEY_REFRESH]) {
          const v = window.localStorage.getItem(k);
          if (v != null) memory.set(k, v);
        }
      } else {
        for (const k of [KEY_ACCESS, KEY_REFRESH]) {
          const v = await SecureStore.getItemAsync(k);
          if (v != null) memory.set(k, v);
        }
      }
      hydrated = true;
    })();
  }
  return hydratePromise;
}

export function getAccess(): string | null {
  return memory.get(KEY_ACCESS) ?? null;
}
export function getRefresh(): string | null {
  return memory.get(KEY_REFRESH) ?? null;
}

export async function setTokens(access?: string | null, refresh?: string | null): Promise<void> {
  await hydrateTokens();
  const next: [string, string | null][] = [
    [KEY_ACCESS, access ?? null],
    [KEY_REFRESH, refresh ?? null],
    // legacy key dipakai app-store untuk deteksi "sudah login" di web
    [LEGACY_ROLE, access ? "1" : null],
  ];
  for (const [k, v] of next) {
    if (v != null) memory.set(k, v);
    else memory.delete(k);
    if (isWeb()) {
      if (v != null) window.localStorage.setItem(k, v);
      else window.localStorage.removeItem(k);
    } else if (k !== LEGACY_ROLE) {
      if (v != null) await SecureStore.setItemAsync(k, v);
      else await SecureStore.deleteItemAsync(k);
    }
  }
}

export async function clearTokens(): Promise<void> {
  await setTokens(null, null);
}

export type ApiError = Error & { status?: number; body?: any; isNetworkError?: boolean };

export function isNetworkError(err: any): boolean {
  if (!err) return false;
  if (err.isNetworkError === true) return true;
  if (typeof err.status === "number") return false;
  if (err instanceof TypeError) return true;
  const msg = String(err.message ?? "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network request failed") ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    msg.includes("fetch failed")
  );
}

async function tryRefresh(): Promise<boolean> {
  await hydrateTokens();
  const r = getRefresh();
  if (!r) return false;
  try {
    const res = await fetch(`${apiBase()}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: r }),
    });
    if (!res.ok) {
      setTokens(null, null);
      return false;
    }
    const data = await res.json();
    setTokens(data?.accessToken ?? data?.access_token, data?.refreshToken ?? data?.refresh_token ?? r);
    return true;
  } catch {
    return false;
  }
}

async function once<T>(
  method: string,
  path: string,
  body: unknown,
  form: FormData | undefined,
  auth: boolean,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (auth) {
    await hydrateTokens();
    const a = getAccess();
    if (a) headers.Authorization = `Bearer ${a}`;
  }
  let payload: BodyInit | undefined;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, { method, headers, body: payload });
  } catch (e: any) {
    const netErr: ApiError = new Error(e?.message || "Tidak dapat terhubung ke server (API Offline)");
    netErr.isNetworkError = true;
    throw netErr;
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: any = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const message =
      (typeof data === "object" && data && (data.message || data.error)) ||
      (Array.isArray(data?.message) ? data.message.join(", ") : null) ||
      `HTTP ${res.status}`;
    const err: ApiError = new Error(typeof message === "string" ? message : JSON.stringify(message));
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data as T;
}

export async function api<T = any>(
  method: string,
  path: string,
  body?: unknown,
  opts: { auth?: boolean; form?: FormData; retry?: boolean } = {},
): Promise<T> {
  let finalBody = body;
  let finalForm = opts.form;
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    finalForm = body;
    finalBody = undefined;
  }
  const auth = opts.auth !== false;
  try {
    return await once<T>(method, path, finalBody, finalForm, auth);
  } catch (e: any) {
    if (e?.status === 401 && auth && opts.retry !== false) {
      const ok = await tryRefresh();
      if (ok) return once<T>(method, path, finalBody, finalForm, auth);
    }
    throw e;
  }
}

export function queryString(params?: Record<string, unknown>): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const MAX_FILE_SIZE_BYTES: Record<"foto" | "dokumen" | "video", number> = {
  foto: 5 * 1024 * 1024,      // 5 MB
  dokumen: 15 * 1024 * 1024,  // 15 MB
  video: 25 * 1024 * 1024,    // 25 MB
};

/** Upload file multipart ke /files, kembalikan file id. */
export async function uploadFile(
  file: { uri?: string; name?: string; type?: string; size?: number } | Blob | File | null | undefined,
  kind: "foto" | "dokumen" | "video" = "dokumen",
  category?: string,
  extra?: { refType?: string; refId?: string | number },
): Promise<number | null> {
  if (!file) return null;

  const maxBytes = MAX_FILE_SIZE_BYTES[kind] ?? 15 * 1024 * 1024;
  let byteSize: number | undefined;
  if (typeof File !== "undefined" && file instanceof File) {
    byteSize = file.size;
  } else if (typeof Blob !== "undefined" && file instanceof Blob) {
    byteSize = file.size;
  } else if ((file as any)?.blob && typeof Blob !== "undefined" && (file as any).blob instanceof Blob) {
    byteSize = (file as any).blob.size;
  } else if (typeof (file as any)?.size === "number") {
    byteSize = (file as any).size;
  }

  if (typeof byteSize === "number" && byteSize > maxBytes) {
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(0);
    const actualMb = (byteSize / (1024 * 1024)).toFixed(1);
    throw new Error(`Ukuran file (${actualMb} MB) melebihi batas maksimal ${maxMb} MB`);
  }

  const form = new FormData();
  if (typeof File !== "undefined" && file instanceof File) {
    form.append("file", file);
  } else if (typeof Blob !== "undefined" && file instanceof Blob) {
    form.append("file", file, (file as any).name || "upload");
  } else if ((file as any)?.blob && typeof Blob !== "undefined" && (file as any).blob instanceof Blob) {
    form.append("file", (file as any).blob, (file as any).name || "upload");
  } else {
    const f = file as { uri?: string; name?: string; type?: string };
    if (!f.uri) return null;
    form.append("file", {
      uri: f.uri,
      name: f.name || "upload",
      type: f.type || "application/octet-stream",
    } as any);
  }
  const query = new URLSearchParams({ kind });
  if (category) query.set("category", category);
  if (extra?.refType) query.set("refType", extra.refType);
  if (extra?.refId != null) query.set("refId", String(extra.refId));
  const res = await api<{ id: number }>("POST", `/files?${query.toString()}`, undefined, { form });
  return res?.id ?? null;
}

/** Upload file Excel/PDF penawaran ke /quotations/:id/upload-excel dan parse otomatis. */
export async function uploadQuotationExcel(
  quotationId: string | number,
  file: { uri?: string; name?: string; blob?: Blob },
): Promise<any> {
  if (file.blob && file.blob.size > 15 * 1024 * 1024) {
    throw new Error("Ukuran file melebihi batas maksimal 15 MB");
  }
  const form = new FormData();
  if (file.blob) {
    form.append("file", file.blob, file.name || "penawaran.xlsx");
  } else if (file.uri) {
    form.append("file", {
      uri: file.uri,
      name: file.name || "penawaran.xlsx",
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    } as any);
  } else {
    throw new Error("File tidak valid");
  }
  return api<any>("POST", `/quotations/${quotationId}/upload-excel`, undefined, { form });
}

export type MasterImportType = "customer" | "supplier" | "product" | "warehouse" | "stock" | "serial";

/** Upload file Excel/CSV ke /imports?type=... dan kembalikan hasil validasi per baris. */
export async function uploadMasterImport(
  type: MasterImportType,
  file: { uri?: string; name?: string; blob?: Blob },
): Promise<{
  type: MasterImportType;
  total: number;
  imported: number;
  failed: Array<{ row: number; error: string; data: Record<string, any> }>;
}> {
  if (file.blob && file.blob.size > 15 * 1024 * 1024) {
    throw new Error("Ukuran file melebihi batas maksimal 15 MB");
  }
  const form = new FormData();
  if (file.blob) {
    form.append("file", file.blob, file.name || `import-${type}.xlsx`);
  } else if (file.uri) {
    form.append("file", {
      uri: file.uri,
      name: file.name || `import-${type}.xlsx`,
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    } as any);
  } else {
    throw new Error("File tidak valid");
  }
  return api("POST", `/imports?type=${type}`, undefined, { form });
}

/** Unduh PDF kompilasi dokumentasi (survey, project, delivery-note, poc) dari server. */
export async function downloadDocumentationPdf(
  kind: "survey" | "project" | "delivery-note" | "poc" | "visit",
  entityId: string | number,
): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  await hydrateTokens();
  const token = getAccess();
  const res = await fetch(`${apiBase()}/documentation/${kind}/${entityId}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return false;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dokumentasi-${kind}-${entityId}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}


