import * as React from "react";
import { MODULES, ROLE_LABEL, type Notif, type Row, type User } from "@/constants/modules";
import { ToastHost, type ToastItem } from "@/components/taska/toast";
import { api, getAccess, setTokens, clearTokens, hydrateTokens } from "@/services/api";
import { connectSocket, type WsDataChange, type WsNotification } from "@/services/socket";
import { ensureNotifPermission, showSystemNotification } from "@/services/notify";
import {
  PATHS, adaptRows, adaptApprovalList, adaptNotifList, adaptRow,
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

type Ctx = {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (patch: { name?: string; phone?: string; avatarFileId?: number; avatarUrl?: string }) => Promise<void>;
  data: DB;
  addRow: (module: string, row: Record<string, any>) => Promise<Row | null>;
  deleteRow: (module: string, id: string) => Promise<boolean>;
  patchRow: (module: string, id: string, patch: Record<string, any>) => Promise<void>;
  setStatus: (module: string, id: string, status: string, note?: string) => Promise<void>;
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
  reload: () => Promise<void>;
  hydrated: boolean;
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
  "leads", "quotations", "surveys", "po-client", "invoices", "projects",
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
    return adaptRows(module, res.items);
  } catch {
    return [];
  }
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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [data, setData] = React.useState<DB>(emptyDB);
  const [hist, setHist] = React.useState<Record<string, HistoryItem[]>>({});
  const [approvals, setApprovals] = React.useState<ApprovalRow[]>([]);
  const [notifs, setNotifs] = React.useState<Notif[]>([]);
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const [offline, setOffline] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);
  const seq = React.useRef(100);

  const toast = React.useCallback((msg: string, tone: ToastItem["tone"] = "success") => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const loadAll = React.useCallback(async () => {
    const [pairs, taskRows, appr, notifRes, stockRes] = await Promise.all([
      Promise.all(EAGER_MODULES.map(async (m) => [m, await fetchList(m)] as const)),
      (async () => {
        try {
          const projectsRes = await api<Page<any>>("GET", "/projects?limit=200");
          return await fetchTasks(adaptRows("projects", projectsRes.items));
        } catch {
          return [] as Row[];
        }
      })(),
      (async () => {
        try {
          const r = await api<{ items: any[] }>("GET", "/approvals/pending");
          return adaptApprovalList(r.items);
        } catch {
          return [] as ApprovalRow[];
        }
      })(),
      (async () => {
        try {
          return await api<Page<any>>("GET", "/notifications?limit=50");
        } catch {
          return null;
        }
      })(),
      (async () => {
        try {
          return await api<Page<any>>("GET", "/stock/summary?limit=500");
        } catch {
          return null;
        }
      })(),
    ]);

    const next = emptyDB();
    for (const [m, rows] of pairs) (next as any)[m] = rows;
    next.tasks = taskRows;
    next.stockSummary = stockRes?.items ?? [];
    setData(next);
    setApprovals(appr);
    setNotifs(adaptNotifList(notifRes?.items));
    return next;
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
      await loadAll();
      // minta izin notifikasi saat masih dalam gestur tap login (iOS perlu gesture)
      void ensureNotifPermission();
    },
    [loadAll],
  );

  const logout = React.useCallback(() => {
    void clearTokens();
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
      setNotifs(adaptNotifList(r.items));
    } catch {}
  }, []);

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
        await loadAll();
      } catch {
        void clearTokens();
      } finally {
        if (alive) setHydrated(true);
      }
    })();
    return () => { alive = false; };
  }, [loadAll]);

  // poll notifications when logged in (fallback when socket.io unavailable)
  React.useEffect(() => {
    if (!user) return;
    const id = setInterval(() => { void refreshNotifs(); }, 30000);
    return () => clearInterval(id);
  }, [user, refreshNotifs]);

  // realtime: data-change → refresh tabel; notification → notif + OS/browser notif
  const refreshModuleRef = React.useRef<((m: string) => Promise<Row[]>) | null>(null);

  React.useEffect(() => {
    if (!user) return;
    let mounted = true;

    const refreshStockSummary = async () => {
      try {
        const res = await api<Page<any>>("GET", "/stock/summary?limit=500");
        if (mounted) setData((d) => ({ ...d, stockSummary: res.items ?? [] }));
      } catch {}
    };

    const handleDataChange = async (c: WsDataChange) => {
      if (!c?.module) return;
      // refresh modul eager; tasks & stockSummary perlu fetch khusus
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
      // kind backend = enum NotifKind (APPROVAL|STOK|PENGIRIMAN|LEAD|TUGAS|SURAT|LAINNYA)
      const WS_KIND: Record<string, Notif["jenis"]> = {
        APPROVAL: "approval", STOK: "stok", PENGIRIMAN: "pengiriman",
        LEAD: "lead", TUGAS: "tugas", SURAT: "surat", LAINNYA: "approval",
      };
      const notif: Notif = {
        id: n.id != null ? String(n.id) : `ws-${Date.now()}`,
        jenis: WS_KIND[n.kind] ?? "approval",
        teks: n.text ?? "",
        waktu: new Date().toISOString(),
        baca: false,
        href: n.href ?? "",
        roles: "all",
      };
      setNotifs((l) => [notif, ...l].slice(0, 100));
      void showSystemNotification({ notif });
      toast(n.text, "info");
    };

    let disconnect: (() => void) | null = null;
    void connectSocket({
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
  }, [user, refreshApprovals, toast]);

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
      setData((d) => ({ ...d, projects, tasks: taskRows }));
      return taskRows;
    }
    const rows = await fetchList(module);
    setData((d) => ({ ...d, [module]: rows }));
    return rows;
  }, []);

  React.useEffect(() => {
    refreshModuleRef.current = refreshModule;
  }, [refreshModule]);

  const offlineQueueRef = React.useRef<{ kind: "add" | "patch"; module: string; id?: string; payload: Record<string, any> }[]>([]);

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
        const tempId = `offline-${Date.now()}`;
        const localRow: Row = { id: tempId, ...row };
        offlineQueueRef.current.push({ kind: "add", module, payload: row });
        setData((d) => ({ ...d, [module]: [localRow, ...(d[module] ?? [])] }));
        toast(`${MODULES[module]?.singular ?? "Data"} disimpan ke antrean offline`, "info");
        return localRow;
      }
      try {
        const body = buildCreateBody(module, row, data);
        const created = await api<any>("POST", path, body);
        const adapted = adaptRow(module, created);
        setData((d) => ({ ...d, [module]: [adapted, ...(d[module] ?? [])] }));
        pushHistory(module, adapted.id, "Membuat data baru");
        toast(`${MODULES[module]?.singular ?? "Data"} disimpan`);
        void refreshModule(module);
        if (module === "leads") void refreshModule("quotations");
        if (module === "followups") void refreshModule("leads");
        return adapted;
      } catch (e: any) {
        toast(e?.message ?? "Gagal menyimpan", "danger");
        return null;
      }
    },
    [data, offline, pushHistory, refreshModule, toast],
  );

  const deleteRow = React.useCallback(
    async (module: string, id: string): Promise<boolean> => {
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
        toast(e?.message ?? "Gagal menghapus", "danger");
        return false;
      }
    },
    [pushHistory, refreshModule, toast],
  );

  const patchRow = React.useCallback(
    async (module: string, id: string, patch: Record<string, any>) => {
      const path = PATHS[module];
      if (!path) return;
      // Optimistic local update so UI-only or immediate fields reflect right away
      setData((d) => ({
        ...d,
        [module]: (d[module] ?? []).map((r: Row) => (r.id === id ? { ...r, ...patch } : r)),
      }));
      if (offline) {
        offlineQueueRef.current.push({ kind: "patch", module, id, payload: patch });
        toast("Perubahan disimpan ke antrean offline", "info");
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
        toast(e?.message ?? "Gagal mengubah", "danger");
      }
    },
    [data, offline, refreshModule, toast],
  );

  // Sinkronkan antrean offline saat kembali online
  React.useEffect(() => {
    if (offline || offlineQueueRef.current.length === 0) return;
    const queue = [...offlineQueueRef.current];
    offlineQueueRef.current = [];
    void (async () => {
      let synced = 0;
      for (const item of queue) {
        try {
          let path = PATHS[item.module];
          if (item.module === "tasks") {
            const pid = item.payload.projectId ?? data.projects[0]?.id;
            if (pid) path = `/projects/${pid}/tasks`;
          }
          if (!path) continue;
          if (item.kind === "add") {
            const body = buildCreateBody(item.module, item.payload, data);
            await api("POST", path, body);
            synced++;
          } else if (item.kind === "patch" && item.id) {
            const body = buildPatchBody(item.module, item.payload, data);
            delete body.id;
            if (Object.keys(body).length > 0) {
              await api("PATCH", `${path}/${item.id}`, body);
              synced++;
            }
          }
        } catch {}
      }
      if (synced > 0) {
        toast(`${synced} data offline berhasil disinkronkan ke server`);
        await loadAll();
      }
    })();
  }, [offline, data, loadAll, toast]);

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
        const created = await api<any>("POST", "/quotations", { leadId: Number(lead.id) });
        const adapted = adaptRow("quotations", created);
        const rows = await refreshModule("quotations");
        const latest = rows.find((q) => q.id === adapted.id) ?? adapted;
        if (!rows.some((q) => q.id === adapted.id)) {
          setData((d) => ({ ...d, quotations: [adapted, ...(d.quotations ?? [])] }));
        }
        pushHistory("quotations", adapted.id, `Dibuat otomatis dari lead: ${lead.nama}`);
        return latest;
      } catch (e: any) {
        toast(e?.message ?? "Gagal membuat penawaran", "danger");
        return null;
      }
    },
    [data.quotations, refreshModule, pushHistory, toast],
  );

  const setStatus = React.useCallback(
    async (module: string, id: string, status: string, note?: string) => {
      const def = MODULES[module];
      const key = def?.statusKey || "status";
      const MASTER_MODULES = [
        "users", "customers", "suppliers", "warehouses", "products",
        "productCategories", "leadSources", "lostReasons", "expenseCategories", "costCenters",
      ];

      // invoice Lunas → catat pembayaran sisa
      if (module === "invoices" && status === "Lunas") {
        const inv = (data.invoices ?? []).find((r) => r.id === id);
        if (inv) {
          const sisa = Math.round(Number(inv.total) - Number(inv.terbayar));
          if (sisa > 0) {
            try {
              await api("POST", `/invoices/${id}/payments`, {
                amount: sisa,
                date: new Date().toISOString().slice(0, 10),
                method: "TRANSFER",
              });
            } catch (e: any) {
              toast(e?.message ?? "Gagal mencatat pembayaran", "danger");
              return;
            }
          } else {
            try {
              await api("POST", `/invoices/${id}/status`, { status: "PAID", note });
            } catch (e: any) {
              toast(e?.message ?? "Gagal mengubah status", "danger");
              return;
            }
          }
        }
      } else if (module === "leads") {
        const body: Record<string, any> = { stage: statusEnumFor("leads", status) };
        if (status === "Won") body.probability = 100;
        if (status === "Lost") {
          body.lostNote = note ?? "";
          const lr = (data.lostReasons ?? []).find((r) => r.nama === note);
          if (lr) body.lostReasonId = Number(lr.id);
        }
        try {
          await api("PATCH", `/leads/${id}`, body);
        } catch (e: any) {
          toast(e?.message ?? "Gagal mengubah status", "danger");
          return;
        }
      } else if (module === "quotations") {
        try {
          if (status === "Terkirim") {
            await api("POST", `/quotations/${id}/send`, {});
          } else if (status === "Menunggu persetujuan") {
            await api("POST", `/quotations/${id}/submit`, {});
          } else {
            await api("PATCH", `/quotations/${id}`, { status: statusEnumFor("quotations", status), notes: note });
          }
        } catch (e: any) {
          toast(e?.message ?? "Gagal mengubah status penawaran", "danger");
          return;
        }
      } else if (module === "surveys") {
        try {
          await api("PATCH", `/surveys/${id}`, { status: statusEnumFor("surveys", status), notes: note });
        } catch (e: any) {
          toast(e?.message ?? "Gagal mengubah status", "danger");
          return;
        }
      } else if (module === "supplier-pos") {
        const enumVal = statusEnumFor("supplier-pos", status);
        try {
          if (["MENUNGGU_PERSETUJUAN", "DISETUJUI", "DITOLAK", "DIBATALKAN"].includes(enumVal)) {
            await api("POST", `/supplier-pos/${id}/status`, { status: enumVal, note });
          } else {
            await api("POST", `/supplier-pos/${id}/shipment`, { shipmentStatus: enumVal });
          }
        } catch (e: any) {
          toast(e?.message ?? "Gagal mengubah status PO", "danger");
          return;
        }
      } else if (module === "opname") {
        try {
          await api("POST", `/opnames/${id}/submit`, { reason: note });
        } catch (e: any) {
          toast(e?.message ?? "Gagal mengajukan opname", "danger");
          return;
        }
      } else if (module === "receiving") {
        try {
          await api("POST", `/receivings/${id}/status`, { status: statusEnumFor("receiving", status), note });
        } catch (e: any) {
          toast(e?.message ?? "Gagal mengubah status penerimaan", "danger");
          return;
        }
      } else if (module === "po-client") {
        // PO client hanya memiliki status tampilan di UI
      } else if (MASTER_MODULES.includes(module)) {
        const path = PATHS[module];
        if (!path) return;
        try {
          await api("PATCH", `${path}/${id}`, { status: statusEnumFor("users", status) });
        } catch (e: any) {
          toast(e?.message ?? "Gagal mengubah status", "danger");
          return;
        }
      } else {
        const path = PATHS[module];
        if (!path) return;
        try {
          await api("POST", `${path}/${id}/status`, buildStatusBody(module, status, note));
        } catch (e: any) {
          toast(e?.message ?? "Gagal mengubah status", "danger");
          return;
        }
      }

      // optimistik
      setData((d) => ({
        ...d,
        [module]: (d[module] ?? []).map((r: any) => (r.id === id ? { ...r, [key]: status } : r)),
      }));
      pushHistory(module, id, `Mengubah status menjadi ${status}${note ? ` (${note})` : ""}`);
      toast(`Status diubah ke ${status}`);

      if (module === "leads" && (status === "Qualification" || status === "Proposal")) {
        const leadRow = (data.leads ?? []).find((l) => l.id === id);
        if (leadRow) setTimeout(() => { void createQuotationFromLead({ ...leadRow, status }); }, 50);
      }

      await refreshModule(module);
      if (module === "leads" && (status === "Qualification" || status === "Proposal")) {
        await refreshModule("quotations");
      }
    },
    [data, pushHistory, toast, refreshModule, createQuotationFromLead],
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
      toast, offline, setOffline, reload, hydrated,
    }),
    [user, login, logout, updateProfile, data, addRow, patchRow, setStatus, createQuotationFromLead, deleteRow,
     history, pushHistory, approvals, decide, myNotifs, unread, markRead, markAllRead,
     toast, offline, reload, hydrated],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      <ToastHost items={toasts} />
    </AppContext.Provider>
  );
}

export function useApp(): Ctx {
  const c = React.useContext(AppContext);
  if (!c) throw new Error("useApp harus di dalam AppProvider");
  return c;
}
