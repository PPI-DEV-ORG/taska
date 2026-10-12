const FALLBACK_BASE = "http://localhost:3000/api";

export function apiBase(): string {
  const fromEnv =
    (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
    (typeof globalThis !== "undefined" && (globalThis as any).process?.env?.EXPO_PUBLIC_API_URL) ||
    "";
  const base = (fromEnv || FALLBACK_BASE).replace(/\/+$/, "");
  return base;
}

/** Origin (tanpa /api) untuk static assets /uploads dan socket.io. */
export function apiOrigin(): string {
  const b = apiBase();
  return b.endsWith("/api") ? b.slice(0, -4) : b;
}

function storage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

const KEY_ACCESS = "taska_access";
const KEY_REFRESH = "taska_refresh";
const LEGACY_ROLE = "taska_role";

export function getAccess(): string | null {
  return storage()?.getItem(KEY_ACCESS) ?? null;
}
export function getRefresh(): string | null {
  return storage()?.getItem(KEY_REFRESH) ?? null;
}
export function setTokens(access?: string | null, refresh?: string | null) {
  const s = storage();
  if (!s) return;
  if (access) s.setItem(KEY_ACCESS, access);
  else s.removeItem(KEY_ACCESS);
  if (refresh) s.setItem(KEY_REFRESH, refresh);
  else s.removeItem(KEY_REFRESH);
  // legacy key dipakai app-store untuk deteksi "sudah login" di web
  if (access) s.setItem(LEGACY_ROLE, "1");
  else s.removeItem(LEGACY_ROLE);
}
export function clearTokens() {
  setTokens(null, null);
}

export type ApiError = Error & { status?: number; body?: any };

async function tryRefresh(): Promise<boolean> {
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
  const res = await fetch(`${apiBase()}${path}`, { method, headers, body: payload });
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
  const auth = opts.auth !== false;
  try {
    return await once<T>(method, path, body, opts.form, auth);
  } catch (e: any) {
    if (e?.status === 401 && auth && opts.retry !== false) {
      const ok = await tryRefresh();
      if (ok) return once<T>(method, path, body, opts.form, auth);
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

/** Upload file multipart ke /files, kembalikan file id. */
export async function uploadFile(
  file: { uri?: string; name?: string; type?: string } | Blob | File | null | undefined,
  kind: "foto" | "dokumen" | "video" = "dokumen",
): Promise<number | null> {
  if (!file) return null;
  const form = new FormData();
  if (typeof File !== "undefined" && file instanceof File) {
    form.append("file", file);
  } else if (typeof Blob !== "undefined" && file instanceof Blob) {
    form.append("file", file, (file as any).name || "upload");
  } else {
    const f = file as { uri?: string; name?: string; type?: string };
    if (!f.uri) return null;
    form.append("file", {
      uri: f.uri,
      name: f.name || "upload",
      type: f.type || "application/octet-stream",
    } as any);
  }
  const res = await api<{ id: number }>("POST", `/files?kind=${kind}`, undefined, { form });
  return res?.id ?? null;
}
