import { Platform } from "react-native";
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

const KEY_ACCESS = "akuntra_access";
const KEY_REFRESH = "akuntra_refresh";
const LEGACY_ROLE = "akuntra_role";

const OLD_KEY_ACCESS = "taska_access";
const OLD_KEY_REFRESH = "taska_refresh";
const OLD_LEGACY_ROLE = "taska_role";

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
      const keyPairs: [string, string][] = [
        [KEY_ACCESS, OLD_KEY_ACCESS],
        [KEY_REFRESH, OLD_KEY_REFRESH],
      ];
      if (isWeb()) {
        for (const [newK, oldK] of keyPairs) {
          let v = window.localStorage.getItem(newK);
          if (v == null) {
            v = window.localStorage.getItem(oldK);
            if (v != null) {
              window.localStorage.setItem(newK, v);
              window.localStorage.removeItem(oldK);
            }
          }
          if (v != null) memory.set(newK, v);
        }
        // Migrasi legacy role jika ada
        const oldRole = window.localStorage.getItem(OLD_LEGACY_ROLE);
        if (oldRole != null) {
          window.localStorage.setItem(LEGACY_ROLE, oldRole);
          window.localStorage.removeItem(OLD_LEGACY_ROLE);
        }
      } else {
        for (const [newK, oldK] of keyPairs) {
          let v = await SecureStore.getItemAsync(newK);
          if (v == null) {
            v = await SecureStore.getItemAsync(oldK);
            if (v != null) {
              await SecureStore.setItemAsync(newK, v);
              await SecureStore.deleteItemAsync(oldK).catch(() => {});
            }
          }
          if (v != null) memory.set(newK, v);
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

/** Tambahkan query access_token pada URL unduhan/preview file agar tetap terautentikasi di <img>/window.open. */
export function appendAccessToken(url: string): string {
  if (!url) return "";
  const token = getAccess();
  if (!token || url.includes("access_token=")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}access_token=${encodeURIComponent(token)}`;
}

/** Bangun URL terautentikasi untuk GET /api/files/:id. */
export function authFileUrl(fileId?: number | string | null): string {
  if (fileId === null || fileId === undefined || fileId === "") return "";
  return appendAccessToken(`${apiBase()}/files/${fileId}`);
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

let refreshInFlight: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  await hydrateTokens();
  const r = getRefresh();
  if (!r) {
    await setTokens(null, null);
    return false;
  }
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 15_000) : null;
  try {
    const res = await fetch(`${apiBase()}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: r }),
      signal: controller?.signal,
    });
    if (!res.ok) {
      await setTokens(null, null);
      return false;
    }
    const data = await res.json();
    await setTokens(
      data?.accessToken ?? data?.access_token,
      data?.refreshToken ?? data?.refresh_token ?? r,
    );
    return true;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/**
 * Kirim FormData di Native (Android/iOS) lewat XMLHttpRequest karena expo/fetch di Expo 58
 * menolak objek { uri, name, type } dengan error "Unsupported FormDataPart implementation".
 */
function sendNativeFormData(
  method: string,
  url: string,
  headers: Record<string, string>,
  form: FormData,
  timeoutMs = 60_000,
): Promise<{ status: number; ok: boolean; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.timeout = timeoutMs;
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === "content-type") continue;
      xhr.setRequestHeader(k, v);
    }
    xhr.onload = () => {
      resolve({
        status: xhr.status,
        ok: xhr.status >= 200 && xhr.status < 300,
        text: typeof xhr.responseText === "string" ? xhr.responseText : "",
      });
    };
    xhr.onerror = () => {
      reject(new Error("Tidak dapat terhubung ke server (API Offline)"));
    };
    xhr.ontimeout = () => {
      reject(new Error("Koneksi upload ke server timeout"));
    };
    xhr.send(form as any);
  });
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

  let status = 0;
  let ok = false;
  let text = "";

  if (form && Platform.OS !== "web") {
    try {
      const xhrRes = await sendNativeFormData(method, `${apiBase()}${path}`, headers, form);
      status = xhrRes.status;
      ok = xhrRes.ok;
      text = xhrRes.text;
    } catch (e: any) {
      const netErr: ApiError = new Error(e?.message || "Tidak dapat terhubung ke server (API Offline)");
      netErr.isNetworkError = true;
      throw netErr;
    }
  } else {
    let payload: BodyInit | undefined;
    if (form) {
      payload = form;
    } else if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    let res: Response;
    const timeoutMs = form ? 60_000 : 30_000;
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      res = await fetch(`${apiBase()}${path}`, {
        method,
        headers,
        body: payload,
        signal: controller?.signal,
      });
    } catch (e: any) {
      const isAbort = e?.name === "AbortError";
      const netErr: ApiError = new Error(
        isAbort
          ? "Permintaan ke server timeout, silakan coba lagi"
          : e?.message || "Tidak dapat terhubung ke server (API Offline)",
      );
      netErr.isNetworkError = true;
      throw netErr;
    } finally {
      if (timer) clearTimeout(timer);
    }
    status = res.status;
    ok = res.ok;
    text = status === 204 ? "" : await res.text();
  }

  if (status === 204) return undefined as T;
  let data: any = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!ok) {
    const message =
      (typeof data === "object" && data && (data.message || data.error)) ||
      (Array.isArray(data?.message) ? data.message.join(", ") : null) ||
      `HTTP ${status}`;
    const err: ApiError = new Error(typeof message === "string" ? message : JSON.stringify(message));
    err.status = status;
    err.body = data;
    throw err;
  }
  return data as T;
}

async function apiFn<T = any>(
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

apiFn.get = <T = any>(path: string, opts?: { auth?: boolean; retry?: boolean }) =>
  apiFn<T>("GET", path, undefined, opts);
apiFn.post = <T = any>(path: string, body?: unknown, opts?: { auth?: boolean; retry?: boolean; form?: FormData }) =>
  apiFn<T>("POST", path, body, opts);
apiFn.put = <T = any>(path: string, body?: unknown, opts?: { auth?: boolean; retry?: boolean; form?: FormData }) =>
  apiFn<T>("PUT", path, body, opts);
apiFn.patch = <T = any>(path: string, body?: unknown, opts?: { auth?: boolean; retry?: boolean; form?: FormData }) =>
  apiFn<T>("PATCH", path, body, opts);
apiFn.delete = <T = any>(path: string, opts?: { auth?: boolean; retry?: boolean }) =>
  apiFn<T>("DELETE", path, undefined, opts);

export const api = apiFn;

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
  failed: { row: number; error: string; data: Record<string, any> }[];
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

/** Unduh PDF kompilasi dokumentasi (survey, project, delivery-note, poc, visit, maintenance) dari server. */
export async function downloadDocumentationPdf(
  kind: "survey" | "project" | "delivery-note" | "poc" | "visit" | "maintenance",
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

/**
 * Surat jalan resmi (PDF dari server: kop, barang + SN, TTD gudang · pengirim · penerima).
 * mode "print" membuka PDF di tab baru siap dicetak; "download" menyimpan file.
 */
export async function openDeliveryNotePdf(id: string | number, number?: string, mode: "print" | "download" = "print"): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  await hydrateTokens();
  const token = getAccess();
  const res = await fetch(`${apiBase()}/delivery-notes/${id}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return false;
  const blob = new Blob([await res.blob()], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  if (mode === "print") {
    const w = window.open(url, "_blank");
    if (w) {
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return true;
    }
  }
  const link = document.createElement("a");
  link.href = url;
  link.download = `surat-jalan-${String(number || id).replace(/[^\w.-]+/g, "-")}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

// ─── Modul Akuntansi Backend (/accounting/*) ───

export async function fetchAccounts(params?: { cash?: boolean; postable?: boolean; category?: string; search?: string }) {
  const query = new URLSearchParams();
  if (params?.cash !== undefined) query.set("cash", String(params.cash));
  if (params?.postable !== undefined) query.set("postable", String(params.postable));
  if (params?.category) query.set("category", params.category);
  if (params?.search) query.set("search", params.search);
  const qStr = query.toString();
  return api<any[]>("GET", `/accounting/accounts${qStr ? `?${qStr}` : ""}`);
}

export async function createAccount(data: any) {
  return api<any>("POST", "/accounting/accounts", data);
}

export async function updateAccount(code: string, data: any) {
  return api<any>("PUT", `/accounting/accounts/${code}`, data);
}

export async function fetchJournals(params?: { page?: number; limit?: number; startDate?: string; endDate?: string; status?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.startDate) query.set("startDate", params.startDate);
  if (params?.endDate) query.set("endDate", params.endDate);
  if (params?.status) query.set("status", params.status);
  const qStr = query.toString();
  return api<{ total: number; page: number; limit: number; items: any[] }>("GET", `/accounting/journals${qStr ? `?${qStr}` : ""}`);
}

export async function createManualJournal(data: { date?: string; memo: string; refNo?: string; projectId?: number; lines: any[] }) {
  return api<any>("POST", "/accounting/journals/manual", data);
}

export async function reverseJournal(id: number, reason: string) {
  return api<any>("POST", `/accounting/journals/${id}/reverse`, { reason });
}

export async function fetchGeneralLedger(params?: { accountCode?: string; startDate?: string; endDate?: string }) {
  const query = new URLSearchParams();
  if (params?.accountCode) query.set("accountCode", params.accountCode);
  if (params?.startDate) query.set("startDate", params.startDate);
  if (params?.endDate) query.set("endDate", params.endDate);
  const qStr = query.toString();
  return api<any[]>("GET", `/accounting/ledger${qStr ? `?${qStr}` : ""}`);
}

export async function fetchTrialBalance(asOfDate?: string) {
  const query = new URLSearchParams();
  if (asOfDate) query.set("asOfDate", asOfDate);
  const qStr = query.toString();
  return api<any>("GET", `/accounting/trial-balance${qStr ? `?${qStr}` : ""}`);
}

export async function fetchIncomeStatement(startDate?: string, endDate?: string) {
  const query = new URLSearchParams();
  if (startDate) query.set("startDate", startDate);
  if (endDate) query.set("endDate", endDate);
  const qStr = query.toString();
  return api<any>("GET", `/accounting/income-statement${qStr ? `?${qStr}` : ""}`);
}

export async function fetchBalanceSheet(asOfDate?: string) {
  const query = new URLSearchParams();
  if (asOfDate) query.set("asOfDate", asOfDate);
  const qStr = query.toString();
  return api<any>("GET", `/accounting/balance-sheet${qStr ? `?${qStr}` : ""}`);
}

export async function fetchCashFlow(startDate?: string, endDate?: string) {
  const query = new URLSearchParams();
  if (startDate) query.set("startDate", startDate);
  if (endDate) query.set("endDate", endDate);
  const qStr = query.toString();
  return api<any>("GET", `/accounting/cash-flow${qStr ? `?${qStr}` : ""}`);
}

export async function fetchTaxSummary(year?: number, month?: number) {
  const query = new URLSearchParams();
  if (year) query.set("year", String(year));
  if (month) query.set("month", String(month));
  const qStr = query.toString();
  return api<any>("GET", `/accounting/tax/summary${qStr ? `?${qStr}` : ""}`);
}

export async function settleVat(data: { year: number; month: number; date?: string; payAccountCode?: string }) {
  return api<any>("POST", "/accounting/tax/vat-settlement", data);
}

export async function remitWithholding(data: { taxType: string; amount: number; date?: string; payAccountCode: string; memo?: string }) {
  return api<any>("POST", "/accounting/tax/withholding-remittance", data);
}

export async function fetchAccountingPeriods(year?: number) {
  const query = new URLSearchParams();
  if (year) query.set("year", String(year));
  const qStr = query.toString();
  return api<any[]>("GET", `/accounting/periods${qStr ? `?${qStr}` : ""}`);
}

export async function requestClosePeriod(year: number, month: number) {
  return api<any>("POST", `/accounting/periods/${year}/${month}/request-close`);
}

export async function approveClosePeriod(year: number, month: number) {
  return api<any>("POST", `/accounting/periods/${year}/${month}/approve-close`);
}

export async function reopenPeriod(year: number, month: number, reopenReason: string) {
  return api<any>("POST", `/accounting/periods/${year}/${month}/reopen`, { reopenReason });
}

export async function closeFiscalYear(year: number, taxEstimated: number) {
  return api<any>("POST", `/accounting/fiscal-years/${year}/close`, { taxEstimated });
}

export async function reopenFiscalYear(year: number, reopenReason: string) {
  return api<any>("POST", `/accounting/fiscal-years/${year}/reopen`, { reopenReason });
}

// ─── AI Assistant (LLM Agent) ───

export type AiPageContext = {
  pathname?: string;
  module?: string;
  entityId?: string;
};

export type AiChatAttachment = {
  fileId: number;
  name: string;
  mimeType?: string;
};

export type AiPendingActionItem = {
  id: number;
  sessionId: number;
  entityType: string;
  entityLabel: string;
  title: string;
  summary: Record<string, string>;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "FAILED";
  resultEntityId: string | null;
  resultHref: string | null;
  errorMessage: string | null;
  expiresAt: string;
  createdAt: string;
};

export type AiCapabilities = {
  configured: boolean;
  model: string;
  providerLabel: string;
  mode: "READ_ONLY" | "READ_AND_DRAFT_CREATE";
  canManageSettings?: boolean;
  creatableEntities?: string[];
  allowedToolNames: string[];
  suggestedPrompts: string[];
};

export type AiLlmSettings = {
  baseUrl: string;
  model: string;
  fallbackModels: string[];
  timeoutMs: number;
  hasApiKey: boolean;
  source: "DB" | "ENV";
  providerLabel: string;
};

export type AiTestConnectionResult = {
  ok: boolean;
  model: string;
  providerLabel: string;
  latencyMs: number;
  reply: string;
};

export type AiChatSessionSummary = {
  id: number;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AiChatMessageItem = {
  id: number;
  role: "user" | "assistant";
  content: string;
  toolsUsed: string[];
  attachments?: AiChatAttachment[];
  createdAt: string;
};

export type AiChatSessionDetail = {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: AiChatMessageItem[];
  pendingActions?: AiPendingActionItem[];
};

export type AiChatReply = {
  sessionId: number;
  sessionTitle: string;
  userMessage: AiChatMessageItem;
  assistantMessage: AiChatMessageItem;
  toolsUsed: string[];
  pendingActions?: AiPendingActionItem[];
};

export async function fetchAiCapabilities() {
  return api<AiCapabilities>("GET", "/ai-agent/capabilities");
}

export async function fetchAiSettings() {
  return api<AiLlmSettings>("GET", "/ai-agent/settings");
}

export async function updateAiSettings(data: {
  baseUrl?: string;
  model?: string;
  fallbackModels?: string[];
  timeoutMs?: number;
  apiKey?: string;
  clearApiKey?: boolean;
}) {
  return api<AiLlmSettings>("PUT", "/ai-agent/settings", data);
}

export async function testAiSettingsConnection() {
  return api<AiTestConnectionResult>("POST", "/ai-agent/settings/test");
}

export async function fetchAiSessions() {
  return api<AiChatSessionSummary[]>("GET", "/ai-agent/sessions");
}

export async function fetchAiSession(id: number) {
  return api<AiChatSessionDetail>("GET", `/ai-agent/sessions/${id}`);
}

export async function deleteAiSession(id: number) {
  return api<{ deleted: boolean; id: number }>("DELETE", `/ai-agent/sessions/${id}`);
}

export async function undoAiLastTurn(sessionId: number, messageId?: number) {
  return api<{
    restoredText: string;
    deletedCount: number;
    messages: AiChatMessageItem[];
    pendingActions: AiPendingActionItem[];
  }>("POST", `/ai-agent/sessions/${sessionId}/undo`, messageId ? { messageId } : {});
}

export async function confirmAiAction(actionId: number) {
  return api<AiPendingActionItem>("POST", `/ai-agent/actions/${actionId}/confirm`);
}

export async function cancelAiAction(actionId: number) {
  return api<AiPendingActionItem>("POST", `/ai-agent/actions/${actionId}/cancel`);
}

export async function sendAiChat(
  message: string,
  sessionId?: number,
  extra?: { pageContext?: AiPageContext; attachments?: AiChatAttachment[] },
) {
  return api<AiChatReply>("POST", "/ai-agent/chat", {
    message,
    ...(sessionId ? { sessionId } : {}),
    ...(extra?.pageContext ? { pageContext: extra.pageContext } : {}),
    ...(extra?.attachments?.length ? { attachments: extra.attachments } : {}),
  });
}

export async function streamAiChat(
  message: string,
  sessionId: number | undefined,
  handlers: {
    onStatus?: (text: string) => void;
    onDelta?: (chunk: string) => void;
  },
  extra?: { pageContext?: AiPageContext; attachments?: AiChatAttachment[] },
): Promise<AiChatReply> {
  if (typeof window === "undefined" || typeof ReadableStream === "undefined") {
    return sendAiChat(message, sessionId, extra);
  }

  await hydrateTokens();
  const token = getAccess();
  const res = await fetch(`${apiBase()}/ai-agent/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message,
      ...(sessionId ? { sessionId } : {}),
      ...(extra?.pageContext ? { pageContext: extra.pageContext } : {}),
      ...(extra?.attachments?.length ? { attachments: extra.attachments } : {}),
    }),
  });

  if (!res.ok || !res.body) {
    let msg = `HTTP ${res.status}`;
    try {
      const errJson = (await res.json()) as { message?: string | string[] };
      if (Array.isArray(errJson.message)) msg = errJson.message.join(", ");
      else if (errJson.message) msg = errJson.message;
    } catch {}
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let donePayload: AiChatReply | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nlIdx = buffer.indexOf("\n");
    while (nlIdx >= 0) {
      const rawLine = buffer.slice(0, nlIdx).trim();
      buffer = buffer.slice(nlIdx + 1);
      nlIdx = buffer.indexOf("\n");

      if (!rawLine.startsWith("data:")) continue;
      const dataStr = rawLine.slice(5).trim();
      if (!dataStr) continue;

      const ev = JSON.parse(dataStr) as
        | { type: "status"; text: string }
        | { type: "delta"; text: string }
        | { type: "done"; payload: AiChatReply }
        | { type: "error"; message: string };

      if (ev.type === "status") {
        handlers.onStatus?.(ev.text);
      } else if (ev.type === "delta") {
        handlers.onDelta?.(ev.text);
      } else if (ev.type === "done") {
        donePayload = ev.payload;
      } else if (ev.type === "error") {
        throw new Error(ev.message);
      }
    }
  }

  if (!donePayload) {
    throw new Error("Streaming selesai tanpa payload jawaban akhir.");
  }
  return donePayload;
}



