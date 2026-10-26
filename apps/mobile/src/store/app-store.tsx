import * as React from "react";
import { Platform } from "react-native";
import { colorScheme } from "nativewind";
import { useRouter } from "expo-router";
import { MODULES, ROLE_LABEL, NAV_BY_ROLE, CAN_APPROVE, type Notif, type Row, type User, type Role } from "@/constants/modules";
import { NotifPopupHost, ToastHost, type NotifPopupItem, type ToastItem } from "@/components/taska/toast";
import { api, getAccess, setTokens, clearTokens, hydrateTokens, isNetworkError } from "@/services/api";
import { connectSocket, type WsDataChange, type WsNotification } from "@/services/socket";
import {
  JENIS_LABEL,
  ensureNotifPermission,
  initWebNotificationRuntime,
  playNotificationSound,
  showSystemNotification,
  syncServiceWorkerAuth,
} from "@/services/notify";
import { setThemePalette } from "@/tokens";
import {
  PATHS, adaptRows, adaptApprovalList, adaptNotifList, adaptRow, normalizeNotifHref,
  apiUserToRow, buildCreateBody, buildPatchBody, buildStatusBody, statusEnumFor,
  type ApiUser, type ApprovalRow, type Page,
} from "@/services/adapters";

export type DB = {
  leads: Row[];
  quotations: Row[];
  surveys: Row[];
  "po-client": Row[];
  invoices: Row[];
  projects: Row[];
  tasks: Row[];
  "purchase-requests": Row[];
  "supplier-pos": Row[];
  receiving: Row[];
  "delivery-notes": Row[];
  expenses: Row[];
  "damage-reports": Row[];
  customers: Row[];
  suppliers: Row[];
  warehouses: Row[];
  products: Row[];
  productCategories: Row[];
  leadSources: Row[];
  lostReasons: Row[];
  expenseCategories: Row[];
  costCenters: Row[];
  followups: Row[];
  issueReports: Row[];
  opname: Row[];
  users: Row[];
  "audit-log": Row[];
  serials: Row[];
  movements: Row[];
  reservations: Row[];
  [k: string]: Row[] | any;
};

export type HistoryItem = { id: string; who: string; what: string; when: string };

export type OfflineQueueItem = {
  qid: string;
  kind: "add" | "patch" | "status";
  module: string;
  id?: string;
  tempId?: string;
  payload: Record<string, any>;
  status?: string;
  note?: string;
  createdAt: string;
};

const STORAGE_QUEUE_KEY = "taska.offline.queue.v1";
const STORAGE_CACHE_DB_KEY = "taska.offline.db.v1";
const STORAGE_CACHE_USER_KEY = "taska.offline.user.v1";

function readStorageJson<T>(key: string, fallback: T): T {
  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch {}
  }
  return fallback;
}

function writeStorageJson(key: string, val: unknown) {
  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    try {
      if (val === null || val === undefined) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify(val));
    } catch {}
  }
}

type Ctx = {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (patch: { name?: string; phone?: string; avatarFileId?: number; avatarUrl?: string }) => Promise<void>;
  data: DB;
  addRow: (module: string, row: Record<string, any>) => Promise<Row | null>;
  deleteRow: (module: string, id: string) => Promise<boolean>;
  patchRow: (module: string, id: string, patch: Record<string, any>) => Promise<void>;
  setStatus: (module: string, id: string, status: string, note?: string, extra?: Record<string, any>) => Promise<void>;
  createQuotationFromLead: (lead: Row, extra?: { items?: any[]; fileUploaded?: boolean; status?: string }) => Promise<Row | null>;
  history: (module: string, id: string) => HistoryItem[];
  pushHistory: (module: string, id: string, what: string) => void;
  approvals: ApprovalRow[];
  decide: (id: string, decision: "Disetujui" | "Ditolak", reason?: string) => Promise<void>;
  notifs: Notif[];
  unread: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  toast: (msg: string, tone?: ToastItem["tone"]) => void;
  offline: boolean;
  setOffline: (v: boolean) => void;
  pendingSyncCount: number;
  syncOfflineQueue: () => Promise<void>;
  reload: () => Promise<void>;
  refreshModule: (module: string) => Promise<Row[]>;
  hydrated: boolean;
  theme: "dark" | "light";
  toggleTheme: () => void;
};

const AppContext = React.createContext<Ctx | null>(null);

const emptyDB = (): DB => ({
  leads: [], quotations: [], surveys: [], "po-client": [], invoices: [],
  projects: [], tasks: [], "purchase-requests": [], "supplier-pos": [],
  receiving: [], "delivery-notes": [], expenses: [], "damage-reports": [],
  customers: [], suppliers: [], warehouses: [], products: [],
  productCategories: [], leadSources: [], lostReasons: [], expenseCategories: [], costCenters: [],
  followups: [], issueReports: [], opname: [], users: [], "audit-log": [],
  serials: [], movements: [], reservations: [], invoiceIn: [],
});

/** Modul yang diambil dari backend saat load. Beberapa dibuat lazily (tasks, stock) karena mahal. */
const EAGER_MODULES = [
  "tasks", "leads", "quotations", "surveys", "po-client", "invoices", "projects",
  "purchase-requests", "supplier-pos", "receiving", "delivery-notes", "expenses",
  "damage-reports", "customers", "suppliers", "warehouses", "products",
  "productCategories", "leadSources", "lostReasons", "expenseCategories", "costCenters",
  "opname", "users", "audit-log", "serials", "movements", "reservations", "followups", "invoiceIn",
] as const;

async function fetchList(module: string): Promise<Row[]> {
  const path = PATHS[module];
  if (!path) return [];
  try {
    const res = await api<Page<any>>("GET", `${path}?limit=200`);
    const rows = adaptRows(module, res.items);
    if (rows.length > 0 || (module !== "users" && module !== "tasks")) return rows;
  } catch {}
  if (module === "tasks") {
    try {
      const pRes = await api<Page<any>>("GET", "/projects?limit=200");
      const projects = adaptRows("projects", pRes.items);
      return await fetchTasks(projects);
    } catch {}
  }
  if (module === "users") {
    try {
      const opts = await api<any[]>("GET", "/users/options");
      return adaptRows("users", Array.isArray(opts) ? opts : []);
    } catch {}
  }
  return [];
}

async function fetchTasks(projects: Row[]): Promise<Row[]> {
  const out: Row[] = [];
  await Promise.all(
    projects.map(async (p) => {
      try {
        const res = await api<Page<any>>("GET", `/projects/${p.id}/tasks?limit=200`);
        out.push(...adaptRows("tasks", res.items));
      } catch {}
    }),
  );
  return out;
}

function readInitialTheme(): "dark" | "light" {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try {
      const saved = window.localStorage.getItem("taska.theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
  }
  return "dark";
}

function applyDomTheme(mode: "dark" | "light") {
  setThemePalette(mode);
  if (Platform.OS !== "web" || typeof window !== "undefined") {
    try {
      colorScheme.set(mode);
    } catch {}
  }
  if (Platform.OS === "web" && typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", mode === "dark");
    document.documentElement.classList.toggle("light", mode === "light");
    try {
      window.localStorage.setItem("taska.theme", mode);
    } catch {}
  }
}

/** Terapkan antrean item `add` yang belum terkirim di atas state DB agar tetap muncul meski halaman di-refresh. */
function overlayPendingAdds(base: DB, queue: OfflineQueueItem[]): DB {
  if (!queue.length) return base;
  const copy: DB = { ...base };
  for (const item of queue) {
    if (item.kind === "add" && item.tempId) {
      const existing: Row[] = Array.isArray(copy[item.module]) ? copy[item.module] : [];
      if (!existing.some((r) => r.id === item.tempId)) {
        copy[item.module] = [{ id: item.tempId, _offlinePending: true, ...item.payload }, ...existing];
      }
    } else if (item.kind === "patch" && item.id) {
      const existing: Row[] = Array.isArray(copy[item.module]) ? copy[item.module] : [];
      copy[item.module] = existing.map((r) => (r.id === item.id ? { ...r, ...item.payload } : r));
    } else if (item.kind === "status" && item.id && item.status) {
      const key = MODULES[item.module]?.statusKey || "status";
      const existing: Row[] = Array.isArray(copy[item.module]) ? copy[item.module] : [];
      copy[item.module] = existing.map((r) => (r.id === item.id ? { ...r, [key]: item.status } : r));
    }
  }
  return copy;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<"dark" | "light">(() => {
    const initial = readInitialTheme();
    setThemePalette(initial);
    return initial;
  });
  const [user, setUser] = React.useState<User | null>(() => readStorageJson<User | null>(STORAGE_CACHE_USER_KEY, null));
  const [data, setData] = React.useState<DB>(() => {
    const cached = readStorageJson<DB | null>(STORAGE_CACHE_DB_KEY, null);
    const q = readStorageJson<OfflineQueueItem[]>(STORAGE_QUEUE_KEY, []);
    return overlayPendingAdds(cached ?? emptyDB(), q);
  });
  const [hist, setHist] = React.useState<Record<string, HistoryItem[]>>({});
  const [approvals, setApprovals] = React.useState<ApprovalRow[]>([]);
  const [notifs, setNotifs] = React.useState<Notif[]>([]);
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const [notifPopups, setNotifPopups] = React.useState<NotifPopupItem[]>([]);
  const seenNotifIdsRef = React.useRef<Set<string>>(new Set());
  const notifHydratedRef = React.useRef<boolean>(false);
  const router = useRouter();
  const [offline, setOffline] = React.useState<boolean>(() => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
    return false;
  });
  const [pendingQueue, setPendingQueue] = React.useState<OfflineQueueItem[]>(() =>
    readStorageJson<OfflineQueueItem[]>(STORAGE_QUEUE_KEY, []),
  );
  const [hydrated, setHydrated] = React.useState(false);
  const seq = React.useRef(100);
  const syncingRef = React.useRef(false);

  const offlineQueueRef = React.useRef<OfflineQueueItem[]>(pendingQueue);

  const updateOfflineQueue = React.useCallback((updater: (prev: OfflineQueueItem[]) => OfflineQueueItem[]) => {
    const next = updater(offlineQueueRef.current);
    offlineQueueRef.current = next;
    setPendingQueue(next);
    writeStorageJson(STORAGE_QUEUE_KEY, next);
  }, []);

  React.useEffect(() => {
    applyDomTheme(theme);
  }, [theme]);

  const toggleTheme = React.useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyDomTheme(next);
      return next;
    });
  }, []);

  const toast = React.useCallback((msg: string, tone: ToastItem["tone"] = "success") => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const closeNotifPopup = React.useCallback((popupId: string) => {
    setNotifPopups((prev) => prev.filter((x) => x.id !== popupId));
  }, []);

  const pushNotifPopup = React.useCallback((notif: Notif, customTitle?: string) => {
    const popupId = `np-${notif.id}-${Date.now()}`;
    const title = customTitle || JENIS_LABEL[notif.jenis] || "Notifikasi Baru";
    setNotifPopups((prev) => {
      const filtered = prev.filter((x) => x.notifId !== notif.id);
      return [{ id: popupId, notifId: notif.id, jenis: notif.jenis, title, text: notif.teks, href: notif.href }, ...filtered].slice(0, 4);
    });
    setTimeout(() => {
      setNotifPopups((prev) => prev.filter((x) => x.id !== popupId));
    }, 6500);
  }, []);

  const triggerRealtimeNotifAlert = React.useCallback(
    (notif: Notif, customTitle?: string) => {
      playNotificationSound();
      pushNotifPopup(notif, customTitle);
      void showSystemNotification({
        title: customTitle || JENIS_LABEL[notif.jenis] || "Taska Mini ERP",
        body: notif.teks,
        notif,
        onlyWhenBackground: true,
      });
    },
    [pushNotifPopup],
  );

  const userRef = React.useRef<User | null>(user);
  React.useEffect(() => {
    userRef.current = user;
  }, [user]);

  const loadAll = React.useCallback(async (targetModules?: readonly string[], targetUser?: User | null) => {
    const activeUser = targetUser ?? userRef.current;
    const role = (activeUser?.role || "").toLowerCase() as Role;
    const navItems = role && NAV_BY_ROLE[role] ? NAV_BY_ROLE[role] : [];
    const roleModuleKeys = new Set(navItems.map((n) => n.key));

    const modulesToFetch = (targetModules ?? EAGER_MODULES).filter((m) => {
      if (m === "audit-log" && role !== "super_admin" && role !== "admin" && role !== "bos") return false;
      return true;
    });

    const isApprover = role && CAN_APPROVE.includes(role);

    const [pairs, notifRes, appr, stockRes] = await Promise.all([
      Promise.all(modulesToFetch.map(async (m) => [m, await fetchList(m)] as const)),
      (async () => {
        try {
          return await api<Page<any>>("GET", "/notifications?limit=50");
        } catch {
          return null;
        }
      })(),
      (async () => {
        if (!isApprover) return [] as ApprovalRow[];
        try {
          const r = await api<{ items: any[] }>("GET", "/approvals/pending");
          return adaptApprovalList(r.items);
        } catch {
          return [] as ApprovalRow[];
        }
      })(),
      (async () => {
        try {
          return await api<Page<any>>("GET", "/stock/summary?limit=200");
        } catch {
          return null;
        }
      })(),
    ]);

    let withOfflineResult: DB | null = null;
    setData((prev) => {
      const next = { ...prev };
      for (const [m, rows] of pairs) (next as any)[m] = rows;
      if (stockRes?.items) next.stockSummary = stockRes.items;
      writeStorageJson(STORAGE_CACHE_DB_KEY, next);
      withOfflineResult = overlayPendingAdds(next, offlineQueueRef.current);
      return withOfflineResult;
    });
    if (appr) setApprovals(appr);
    if (notifRes) {
      const adaptedNotifs = adaptNotifList(notifRes.items);
      for (const n of adaptedNotifs) seenNotifIdsRef.current.add(String(n.id));
      notifHydratedRef.current = true;
      setNotifs(adaptedNotifs);
      syncServiceWorkerAuth(Array.from(seenNotifIdsRef.current));
    }
    return withOfflineResult;
  }, []);

  const login = React.useCallback(
    async (email: string, password: string) => {
      const res = await api<{ accessToken: string; refreshToken: string; user: ApiUser }>(
        "POST", "/auth/login", { email, password }, { auth: false },
      );
      await setTokens(res.accessToken, res.refreshToken);
      const u = apiUserToRow(res.user);
      u.roleLabel = ROLE_LABEL[u.role] ?? u.role;
      setUser(u);
      writeStorageJson(STORAGE_CACHE_USER_KEY, u);
      setOffline(false);
      await loadAll();
      // minta izin notifikasi saat masih dalam gestur tap login (iOS perlu gesture)
      void ensureNotifPermission();
    },
    [loadAll],
  );

  const logout = React.useCallback(() => {
    void clearTokens();
    writeStorageJson(STORAGE_CACHE_USER_KEY, null);
    seenNotifIdsRef.current.clear();
    notifHydratedRef.current = false;
    setNotifPopups([]);
    syncServiceWorkerAuth([]);
    setUser(null);
    setData(emptyDB());
    setApprovals([]);
    setNotifs([]);
  }, []);

  const updateProfile = React.useCallback(
    async (patch: { name?: string; phone?: string; avatarFileId?: number; avatarUrl?: string }) => {
      try {
        const updated = await api<ApiUser>("PATCH", "/auth/me", {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
          ...(patch.avatarFileId !== undefined ? { avatarFileId: patch.avatarFileId } : {}),
        });
        const u = apiUserToRow(updated);
        u.roleLabel = ROLE_LABEL[u.role] ?? u.role;
        if (patch.avatarUrl && !u.avatarUrl) u.avatarUrl = patch.avatarUrl;
        setUser(u);
        writeStorageJson(STORAGE_CACHE_USER_KEY, u);
        toast("Profil berhasil diperbarui");
      } catch (e: any) {
        toast(e?.message ?? "Gagal memperbarui profil", "danger");
      }
    },
    [toast],
  );

  const reload = React.useCallback(async () => {
    await loadAll();
  }, [loadAll]);

  const refreshNotifs = React.useCallback(async () => {
    try {
      const r = await api<Page<any>>("GET", "/notifications?limit=50");
      const adapted = adaptNotifList(r.items);
      if (notifHydratedRef.current) {
        const unseenUnread = adapted.filter((n) => !n.baca && !seenNotifIdsRef.current.has(String(n.id)));
        for (const n of unseenUnread.slice(0, 2)) {
          seenNotifIdsRef.current.add(String(n.id));
          triggerRealtimeNotifAlert(n);
        }
      }
      for (const n of adapted) seenNotifIdsRef.current.add(String(n.id));
      notifHydratedRef.current = true;
      setNotifs(adapted);
      syncServiceWorkerAuth(Array.from(seenNotifIdsRef.current));
    } catch {}
  }, [triggerRealtimeNotifAlert]);

  const refreshApprovals = React.useCallback(async () => {
    try {
      const r = await api<{ items: any[] }>("GET", "/approvals/pending");
      setApprovals(adaptApprovalList(r.items));
    } catch {}
  }, []);

  // restore session on mount
  React.useEffect(() => {
    let alive = true;
    (async () => {
      await hydrateTokens();
      if (!getAccess()) {
        if (alive) setHydrated(true);
        return;
      }
      try {
        const me = await api<ApiUser>("GET", "/auth/me");
        if (!alive) return;
        const u = apiUserToRow(me);
        u.roleLabel = ROLE_LABEL[u.role] ?? u.role;
        setUser(u);
        writeStorageJson(STORAGE_CACHE_USER_KEY, u);
        setOffline(false);
        await loadAll(undefined, u);
        void ensureNotifPermission();
      } catch (err: any) {
        if (isNetworkError(err)) {
          // Server sedang mati/down, pertahankan sesi lokal & aktifkan mode offline
          if (alive) {
            setOffline(true);
            const cachedUser = readStorageJson<User | null>(STORAGE_CACHE_USER_KEY, null);
            if (cachedUser) setUser(cachedUser);
          }
        } else {
          void clearTokens();
          writeStorageJson(STORAGE_CACHE_USER_KEY, null);
        }
      } finally {
        if (alive) setHydrated(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Browser online/offline event listener + auto-ping API ketika offline atau ada antrean
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onBrowserOffline = () => setOffline(true);
    const onBrowserOnline = () => {
      void (async () => {
        try {
          await api("GET", "/auth/me");
          setOffline(false);
        } catch {}
      })();
    };
    window.addEventListener("offline", onBrowserOffline);
    window.addEventListener("online", onBrowserOnline);
    return () => {
      window.removeEventListener("offline", onBrowserOffline);
      window.removeEventListener("online", onBrowserOnline);
    };
  }, []);

  // Poll health API setiap 6 detik saat offline atau saat ada antrean yang belum terkirim
  React.useEffect(() => {
    if (!user) return;
    if (!offline && pendingQueue.length === 0) return;
    const timer = setInterval(() => {
      void (async () => {
        try {
          await api("GET", "/auth/me");
          setOffline(false);
        } catch (err: any) {
          if (isNetworkError(err)) {
            setOffline(true);
          }
        }
      })();
    }, 6000);
    return () => clearInterval(timer);
  }, [user, offline, pendingQueue.length]);

  // poll notifications when logged in (fallback when socket.io unavailable)
  React.useEffect(() => {
    if (!user || offline) return;
    initWebNotificationRuntime((href) => {
      try {
        router.push(href as any);
      } catch {}
    });
    const id = setInterval(() => { void refreshNotifs(); }, 15000);
    return () => clearInterval(id);
  }, [user, offline, refreshNotifs, router]);

  // realtime: data-change → refresh tabel; notification → popup pojok kanan atas + suara *ting* + OS/browser notif
  const refreshModuleRef = React.useRef<((m: string) => Promise<Row[]>) | null>(null);

  React.useEffect(() => {
    if (!user) return;
    let mounted = true;

    const refreshStockSummary = async () => {
      try {
        const res = await api<Page<any>>("GET", "/stock/summary?limit=200");
        if (mounted) setData((d) => ({ ...d, stockSummary: res.items ?? [] }));
      } catch {}
    };

    const handleDataChange = async (c: WsDataChange) => {
      if (!c?.module) return;
      const eager = (EAGER_MODULES as readonly string[]).includes(c.module);
      if (eager) {
        await refreshModuleRef.current?.(c.module);
      } else if (c.module === "tasks") {
        const projects = await fetchList("projects");
        const taskRows = await fetchTasks(projects);
        if (mounted) setData((d) => ({ ...d, tasks: taskRows }));
      } else if (["stock", "movements", "serials", "reservations", "products"].includes(c.module)) {
        await refreshStockSummary();
        if (c.module === "products") await refreshModuleRef.current?.("products");
      } else if (c.module === "approvals") {
        await refreshApprovals();
      }
    };

    const handleNotification = async (n: WsNotification) => {
      if (!mounted) return;
      const WS_KIND: Record<string, Notif["jenis"]> = {
        APPROVAL: "approval", STOK: "stok", PENGIRIMAN: "pengiriman",
        LEAD: "lead", TUGAS: "tugas", SURAT: "surat", LAINNYA: "approval",
      };
      const notifId = n.id != null ? String(n.id) : `ws-${Date.now()}`;
      const alreadySeen = n.id != null && seenNotifIdsRef.current.has(notifId);
      seenNotifIdsRef.current.add(notifId);

      const notif: Notif = {
        id: notifId,
        jenis: WS_KIND[n.kind] ?? "approval",
        teks: n.text ?? "",
        waktu: n.createdAt ?? new Date().toISOString(),
        baca: false,
        href: normalizeNotifHref(n.href),
        roles: "all",
      };
      setNotifs((l) => [notif, ...l.filter((x) => x.id !== notifId)].slice(0, 100));
      syncServiceWorkerAuth(Array.from(seenNotifIdsRef.current));
      if (!alreadySeen) {
        triggerRealtimeNotifAlert(notif, n.title);
      }
    };

    let disconnect: (() => void) | null = null;
    void connectSocket({
      onConnect: () => {
        void refreshNotifs();
      },
      onDataChange: (c) => { void handleDataChange(c); },
      onNotification: (n) => { void handleNotification(n); },
    }).then((d) => {
      if (mounted) disconnect = d;
      else d();
    });

    return () => {
      mounted = false;
      disconnect?.();
    };
  }, [user, refreshApprovals, refreshNotifs, triggerRealtimeNotifAlert]);

  const pushHistory = React.useCallback(
    (module: string, id: string, what: string) => {
      const k = `${module}:${id}`;
      setHist((h) => ({
        ...h,
        [k]: [{ id: String(++seq.current), who: user?.name ?? "-", what, when: new Date().toISOString() }, ...(h[k] ?? [])],
      }));
    },
    [user],
  );

  const refreshModule = React.useCallback(async (module: string) => {
    if (module === "tasks") {
      const projects = await fetchList("projects");
      const taskRows = await fetchTasks(projects);
      setData((d) => {
        const next = overlayPendingAdds({ ...d, projects, tasks: taskRows }, offlineQueueRef.current);
        writeStorageJson(STORAGE_CACHE_DB_KEY, next);
        return next;
      });
      return taskRows;
    }
    const rows = await fetchList(module);
    let extraStock: any = undefined;
    if (module === "products" || module === "serials" || module === "stock" || module === "warehouses") {
      try {
        const sRes = await api<Page<any>>("GET", "/stock/summary?limit=200");
        if (sRes?.items) extraStock = sRes.items;
      } catch {}
    }
    setData((d) => {
      const next = overlayPendingAdds({
        ...d,
        [module]: rows,
        ...(extraStock ? { stockSummary: extraStock } : {}),
      }, offlineQueueRef.current);
      writeStorageJson(STORAGE_CACHE_DB_KEY, next);
      return next;
    });
    return rows;
  }, []);

  React.useEffect(() => {
    refreshModuleRef.current = refreshModule;
  }, [refreshModule]);

  const enqueueOfflineAdd = React.useCallback(
    (module: string, row: Record<string, any>): Row => {
      const tempId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const localRow: Row = { id: tempId, _offlinePending: true, ...row };
      updateOfflineQueue((prev) => [
        ...prev,
        {
          qid: tempId,
          kind: "add",
          module,
          tempId,
          payload: row,
          createdAt: new Date().toISOString(),
        },
      ]);
      setData((d) => {
        const next = { ...d, [module]: [localRow, ...(d[module] ?? [])] };
        writeStorageJson(STORAGE_CACHE_DB_KEY, next);
        return next;
      });
      toast(
        `Server sedang offline. ${MODULES[module]?.singular ?? "Data"} disimpan di browser & otomatis dikirim saat online.`,
        "info",
      );
      return localRow;
    },
    [toast, updateOfflineQueue],
  );

  const enqueueOfflinePatch = React.useCallback(
    (module: string, id: string, patch: Record<string, any>) => {
      updateOfflineQueue((prev) => {
        // Jika baris yang di-patch masih berada di antrean add offline, gabungkan langsung ke payload add
        const addIdx = prev.findIndex((x) => x.kind === "add" && x.tempId === id && x.module === module);
        if (addIdx >= 0) {
          const copy = [...prev];
          const target = copy[addIdx]!;
          copy[addIdx] = { ...target, payload: { ...target.payload, ...patch } };
          return copy;
        }
        return [
          ...prev,
          {
            qid: `patch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            kind: "patch",
            module,
            id,
            payload: patch,
            createdAt: new Date().toISOString(),
          },
        ];
      });
      toast("Server sedang offline. Perubahan disimpan di browser & otomatis dikirim saat online.", "info");
    },
    [toast, updateOfflineQueue],
  );

  const enqueueOfflineStatus = React.useCallback(
    (module: string, id: string, status: string, note?: string) => {
      const def = MODULES[module];
      const key = def?.statusKey || "status";
      setData((d) => {
        const next = {
          ...d,
          [module]: (d[module] ?? []).map((r: any) => (r.id === id ? { ...r, [key]: status } : r)),
        };
        writeStorageJson(STORAGE_CACHE_DB_KEY, next);
        return next;
      });
      updateOfflineQueue((prev) => [
        ...prev,
        {
          qid: `status-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          kind: "status",
          module,
          id,
          payload: {},
          status,
          note,
          createdAt: new Date().toISOString(),
        },
      ]);
      toast(`Server sedang offline. Perubahan status '${status}' disimpan di browser & dikirim saat online.`, "info");
    },
    [toast, updateOfflineQueue],
  );

  const addRow = React.useCallback(
    async (module: string, row: Record<string, any>): Promise<Row | null> => {
      let path = PATHS[module];
      if (module === "tasks") {
        const pid = row.projectId ?? data.projects.find((p) => p.nama === row.project)?.id ?? data.projects[0]?.id;
        if (!pid) {
          toast("Project belum dipilih untuk tugas ini", "danger");
          return null;
        }
        path = `/projects/${pid}/tasks`;
      }
      if (!path) return null;
      if (offline) {
        return enqueueOfflineAdd(module, row);
      }
      try {
        const body = buildCreateBody(module, row, data);
        const created = await api<any>("POST", path, body);
        const adapted = adaptRow(module, created);
        setData((d) => {
          const next = { ...d, [module]: [adapted, ...(d[module] ?? [])] };
          writeStorageJson(STORAGE_CACHE_DB_KEY, next);
          return next;
        });
        pushHistory(module, adapted.id, "Membuat data baru");
        toast(`${MODULES[module]?.singular ?? "Data"} disimpan`);
        void refreshModule(module);
        if (module === "leads") void refreshModule("quotations");
        if (module === "followups") void refreshModule("leads");
        if (module === "invoices") void refreshModule("projects");
        return adapted;
      } catch (e: any) {
        if (isNetworkError(e)) {
          setOffline(true);
          return enqueueOfflineAdd(module, row);
        }
        toast(e?.message ?? "Gagal menyimpan", "danger");
        return null;
      }
    },
    [data, offline, enqueueOfflineAdd, pushHistory, refreshModule, toast],
  );

  const deleteRow = React.useCallback(
    async (module: string, id: string): Promise<boolean> => {
      // Jika item adalah item lokal yang belum terkirim ke server, hapus langsung dari antrean
      if (String(id).startsWith("offline-")) {
        updateOfflineQueue((prev) => prev.filter((x) => x.tempId !== id && x.id !== id));
        setData((d) => ({ ...d, [module]: (d[module] ?? []).filter((r: Row) => r.id !== id) }));
        toast("Data antrean offline dihapus");
        return true;
      }
      const path = PATHS[module];
      if (!path) return false;
      try {
        await api("DELETE", `${path}/${id}`);
        setData((d) => ({ ...d, [module]: (d[module] ?? []).filter((r: Row) => r.id !== id) }));
        pushHistory(module, id, "Menghapus data");
        toast(`${MODULES[module]?.singular ?? "Data"} dihapus`);
        if (module === "tasks") void refreshModule("projects");
        return true;
      } catch (e: any) {
        if (isNetworkError(e)) setOffline(true);
        toast(e?.message ?? "Gagal menghapus", "danger");
        return false;
      }
    },
    [pushHistory, refreshModule, toast, updateOfflineQueue],
  );

  const patchRow = React.useCallback(
    async (module: string, id: string, patch: Record<string, any>) => {
      const path = PATHS[module];
      if (!path) return;
      // Optimistic local update so UI-only or immediate fields reflect right away
      setData((d) => {
        const next = {
          ...d,
          [module]: (d[module] ?? []).map((r: Row) => (r.id === id ? { ...r, ...patch } : r)),
        };
        writeStorageJson(STORAGE_CACHE_DB_KEY, next);
        return next;
      });
      if (offline || String(id).startsWith("offline-")) {
        enqueueOfflinePatch(module, id, patch);
        return;
      }
      try {
        const body = buildPatchBody(module, patch, data);
        delete body.id;
        if (Object.keys(body).length > 0) {
          await api("PATCH", `${path}/${id}`, body);
          await refreshModule(module);
        }
      } catch (e: any) {
        if (isNetworkError(e)) {
          setOffline(true);
          enqueueOfflinePatch(module, id, patch);
          return;
        }
        toast(e?.message ?? "Gagal mengubah", "danger");
      }
    },
    [data, offline, enqueueOfflinePatch, refreshModule, toast],
  );

  const executeRemoteStatus = React.useCallback(
    async (module: string, id: string, status: string, note?: string, extra?: Record<string, any>) => {
      const MASTER_MODULES = [
        "users", "customers", "suppliers", "warehouses", "products",
        "productCategories", "leadSources", "lostReasons", "expenseCategories", "costCenters",
      ];

      if (module === "invoices" && status === "Lunas") {
        const inv = (data.invoices ?? []).find((r) => r.id === id);
        if (inv) {
          const sisa = Math.round(Number(inv.total) - Number(inv.terbayar));
          if (sisa > 0) {
            await api("POST", `/invoices/${id}/payments`, {
              amount: sisa,
              date: new Date().toISOString().slice(0, 10),
              method: "TRANSFER",
            });
          }
          await api("POST", `/invoices/${id}/status`, { status: "PAID", note });
        }
      } else if (module === "leads") {
        const body: Record<string, any> = { stage: statusEnumFor("leads", status) };
        if (status === "Won") body.probability = 100;
        if (status === "Lost") {
          body.lostNote = note ?? "";
          const lr = (data.lostReasons ?? []).find((r) => r.nama === note);
          if (lr) body.lostReasonId = Number(lr.id);
        }
        await api("PATCH", `/leads/${id}`, body);
      } else if (module === "quotations") {
        const enumVal = statusEnumFor("quotations", status);
        if (status === "Terkirim" || enumVal === "SENT") {
          await api("POST", `/quotations/${id}/send`, {});
        } else if (status === "Menunggu persetujuan" || enumVal === "PENDING_APPROVAL") {
          await api("POST", `/quotations/${id}/submit`, {});
        } else {
          await api("POST", `/quotations/${id}/status`, { status: enumVal, note });
        }
      } else if (module === "surveys") {
        await api("PATCH", `/surveys/${id}`, { status: statusEnumFor("surveys", status), notes: note });
      } else if (module === "supplier-pos") {
        const enumVal = statusEnumFor("supplier-pos", status);
        if (["MENUNGGU_PERSETUJUAN", "DISETUJUI", "DITOLAK", "DIBATALKAN"].includes(enumVal)) {
          await api("POST", `/supplier-pos/${id}/status`, { status: enumVal, note });
        } else {
          await api("POST", `/supplier-pos/${id}/shipment`, { shipmentStatus: enumVal });
        }
      } else if (module === "opname") {
        await api("POST", `/opnames/${id}/submit`, { reason: note });
      } else if (module === "receiving") {
        await api("POST", `/receivings/${id}/status`, { status: statusEnumFor("receiving", status), note });
      } else if (module === "po-client") {
        // PO client hanya memiliki status tampilan di UI
      } else if (MASTER_MODULES.includes(module)) {
        const path = PATHS[module];
        if (path) {
          await api("PATCH", `${path}/${id}`, { status: statusEnumFor("users", status) });
        }
      } else {
        const path = PATHS[module];
        if (path) {
          await api("POST", `${path}/${id}/status`, buildStatusBody(module, status, note, extra));
        }
      }
    },
    [data.invoices, data.lostReasons],
  );

  // Fungsi sinkronisasi antrean offline ke server saat API online kembali
  const syncOfflineQueue = React.useCallback(async () => {
    if (syncingRef.current || offlineQueueRef.current.length === 0) return;
    syncingRef.current = true;
    try {
      const queue = [...offlineQueueRef.current];
      const remaining: OfflineQueueItem[] = [];
      let synced = 0;

      for (let i = 0; i < queue.length; i++) {
        const item = queue[i]!;
        try {
          let path = PATHS[item.module];
          if (item.module === "tasks") {
            const pid =
              item.payload.projectId ??
              data.projects.find((p) => p.nama === item.payload.project)?.id ??
              data.projects[0]?.id;
            if (pid) path = `/projects/${pid}/tasks`;
          }
          if (!path && item.kind !== "status") continue;

          if (item.kind === "add" && path) {
            const body = buildCreateBody(item.module, item.payload, data);
            await api("POST", path, body);
            synced++;
          } else if (item.kind === "patch" && item.id && path) {
            const body = buildPatchBody(item.module, item.payload, data);
            delete body.id;
            if (Object.keys(body).length > 0) {
              await api("PATCH", `${path}/${item.id}`, body);
            }
            synced++;
          } else if (item.kind === "status" && item.id && item.status) {
            await executeRemoteStatus(item.module, item.id, item.status, item.note);
            synced++;
          }
        } catch (err: any) {
          if (isNetworkError(err)) {
            // API mati lagi di tengah pengiriman — simpan sisa antrean untuk percobaan berikutnya
            setOffline(true);
            remaining.push(...queue.slice(i));
            break;
          }
          // Jika ditolak validasi server (400/422), lewati item agar tidak menyumbat antrean & beri tahu user
          toast(`Gagal sinkron 1 item (${item.module}): ${err?.message || "Data tidak valid"}`, "danger");
        }
      }

      updateOfflineQueue(() => remaining);
      if (synced > 0) {
        toast(`${synced} data dari antrean browser berhasil dikirim ke server!`);
        await loadAll();
      }
    } finally {
      syncingRef.current = false;
    }
  }, [data, executeRemoteStatus, loadAll, toast, updateOfflineQueue]);

  // Sinkronkan antrean offline otomatis saat status berubah menjadi online
  React.useEffect(() => {
    if (!offline && pendingQueue.length > 0 && user) {
      void syncOfflineQueue();
    }
  }, [offline, pendingQueue.length, user, syncOfflineQueue]);

  const createQuotationFromLead = React.useCallback(
    async (lead: Row, extra?: { items?: any[]; fileUploaded?: boolean; status?: string }): Promise<Row | null> => {
      const existing = (data.quotations ?? []).find((q) => q.leadId === lead.id);
      if (existing && !extra) return existing;
      if (existing && extra) {
        try {
          await api("PATCH", `/quotations/${existing.id}`, {
            total: extra.items ? extra.items.reduce((a: number, c: any) => a + c.qty * c.harga, 0) : undefined,
          });
          await refreshModule("quotations");
        } catch {}
        return existing;
      }
      try {
        const leadVal = Number(lead.nilai) || undefined;
        const ppnVal = leadVal ? Math.round(leadVal * 0.11) : 0;
        const created = await api<any>("POST", "/quotations", {
          leadId: Number(lead.id),
          total: leadVal,
          ppn: ppnVal,
          grandTotal: leadVal ? leadVal + ppnVal : undefined,
        });
        const adapted = adaptRow("quotations", created);
        const rows = await refreshModule("quotations");
        const latest = rows.find((q) => q.id === adapted.id) ?? adapted;
        if (!rows.some((q) => q.id === adapted.id)) {
          setData((d) => ({ ...d, quotations: [adapted, ...(d.quotations ?? [])] }));
        }
        pushHistory("quotations", adapted.id, `Dibuat otomatis dari lead: ${lead.nama}`);
        return latest;
      } catch (e: any) {
        if (isNetworkError(e)) {
          setOffline(true);
          return null;
        }
        toast(e?.message ?? "Gagal membuat penawaran", "danger");
        return null;
      }
    },
    [data.quotations, refreshModule, pushHistory, toast],
  );

  const setStatus = React.useCallback(
    async (module: string, id: string, status: string, note?: string, extra?: Record<string, any>) => {
      const def = MODULES[module];
      const key = def?.statusKey || "status";

      if (offline || String(id).startsWith("offline-")) {
        enqueueOfflineStatus(module, id, status, note);
        return;
      }

      try {
        await executeRemoteStatus(module, id, status, note, extra);
      } catch (e: any) {
        if (isNetworkError(e)) {
          setOffline(true);
          enqueueOfflineStatus(module, id, status, note);
          return;
        }
        toast(e?.message ?? "Gagal mengubah status", "danger");
        return;
      }

      // optimistik
      setData((d) => {
        let updatedModuleList = d[module] ?? [];
        if (module === "invoices" && status === "Lunas") {
          const targetInv = updatedModuleList.find((r: any) => r.id === id);
          const isPelunasanOrSubsequent =
            targetInv &&
            (targetInv.jenis === "Pelunasan" ||
              /pelunasan/i.test(targetInv.catatan || "") ||
              /\/(?:[2-9]|\d{2,})$/.test(targetInv.nomor || ""));
          const basePrefix = targetInv?.nomor?.match(/^(INV\/\d{4}\/\d{2}\/\d+)(?:\/\d+)?$/i)?.[1];

          updatedModuleList = updatedModuleList.map((r: any) => {
            if (r.id === id) {
              return {
                ...r,
                [key]: status,
                terbayar: r.total,
                ...(extra ?? {}),
              };
            }
            if (isPelunasanOrSubsequent && targetInv) {
              const isSibling =
                (targetInv.projectId && r.projectId === targetInv.projectId) ||
                (targetInv.quotationId && r.quotationId === targetInv.quotationId) ||
                (targetInv.quotation && r.quotation === targetInv.quotation) ||
                (basePrefix && r.nomor?.startsWith(basePrefix));
              if (isSibling && r.status !== "Dibatalkan" && r.status !== "Batal") {
                return {
                  ...r,
                  [key]: status,
                  terbayar: r.total,
                };
              }
            }
            return r;
          });
        } else {
          updatedModuleList = updatedModuleList.map((r: any) =>
            r.id === id
              ? {
                  ...r,
                  [key]: status,
                  ...(extra ?? {}),
                }
              : r
          );
        }

        return {
          ...d,
          [module]: updatedModuleList,
          ...(module === "invoices" && status === "Lunas"
            ? {
                projects: (d.projects ?? []).map((p: any) => {
                  const inv = (d.invoices ?? []).find((r) => r.id === id);
                  if (inv && (String(p.id) === String(inv.projectId) || p.nama === inv.project)) {
                    return { ...p, pembayaran: "Lunas" };
                  }
                  return p;
                }),
              }
            : {}),
        };
      });
      pushHistory(module, id, `Mengubah status menjadi ${status}${note ? ` (${note})` : ""}`);
      toast(`Status diubah ke ${status}`);

      await refreshModule(module);
      if (module === "invoices") {
        await refreshModule("projects");
      }
    },
    [data.leads, offline, enqueueOfflineStatus, executeRemoteStatus, pushHistory, toast, refreshModule, createQuotationFromLead],
  );

  const history = React.useCallback(
    (module: string, id: string): HistoryItem[] => {
      const custom = hist[`${module}:${id}`] ?? [];
      const row = (data[module] as Row[] | undefined)?.find((r: any) => r.id === id);
      const owner = row?.pemilik ?? row?.pembuat ?? row?.pemohon ?? row?.pelapor ?? row?.pm ?? "Sistem";
      return [
        ...custom,
        { id: "d1", who: owner, what: "Membuat data", when: row?.createdAt ?? new Date().toISOString() },
      ];
    },
    [hist, data],
  );

  const decide = React.useCallback(
    async (id: string, decision: "Disetujui" | "Ditolak", reason?: string) => {
      try {
        await api("POST", `/approvals/${id}/decide`, {
          approve: decision === "Disetujui",
          reason,
        });
        setApprovals((l) => l.map((x) => (x.id === id ? { ...x, status: decision } : x)));
        toast(decision === "Disetujui" ? "Dokumen disetujui" : "Dokumen ditolak", decision === "Disetujui" ? "success" : "danger");
        await reload();
      } catch (e: any) {
        if (isNetworkError(e)) setOffline(true);
        toast(e?.message ?? "Gagal memutuskan", "danger");
      }
    },
    [toast, reload],
  );

  const myNotifs = notifs;
  const unread = myNotifs.filter((n) => !n.baca).length;
  const markRead = React.useCallback(async (id: string) => {
    setNotifs((l) => l.map((n) => (n.id === id ? { ...n, baca: true } : n)));
    try { await api("POST", "/notifications/read", { ids: [Number(id)] }); } catch {}
  }, []);
  const markAllRead = React.useCallback(async () => {
    setNotifs((l) => l.map((n) => ({ ...n, baca: true })));
    try { await api("POST", "/notifications/read-all"); } catch {}
  }, []);

  const value = React.useMemo<Ctx>(
    () => ({
      user, login, logout, updateProfile, data, addRow, patchRow, setStatus, createQuotationFromLead,
      deleteRow,
      history, pushHistory, approvals, decide, notifs: myNotifs, unread, markRead, markAllRead,
      toast, offline, setOffline,
      pendingSyncCount: pendingQueue.length,
      syncOfflineQueue,
      reload, refreshModule, hydrated, theme, toggleTheme,
    }),
    [user, login, logout, updateProfile, data, addRow, patchRow, setStatus, createQuotationFromLead, deleteRow,
     history, pushHistory, approvals, decide, myNotifs, unread, markRead, markAllRead,
     toast, offline, pendingQueue.length, syncOfflineQueue, reload, refreshModule, hydrated, theme, toggleTheme],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      <NotifPopupHost
        items={notifPopups}
        onClose={closeNotifPopup}
        onSelect={(item) => {
          closeNotifPopup(item.id);
          if (item.notifId) void markRead(item.notifId);
          if (item.href) {
            try {
              router.push(item.href as any);
            } catch {}
          }
        }}
      />
      <ToastHost items={toasts} />
    </AppContext.Provider>
  );
}

export function useApp(): Ctx {
  const c = React.useContext(AppContext);
  if (!c) throw new Error("useApp harus di dalam AppProvider");
  return c;
}

