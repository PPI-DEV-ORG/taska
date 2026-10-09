import * as React from "react";
import {
  APPROVALS, AUDIT_LOG, CUSTOMERS, DAMAGE_REPORTS, DELIVERY_NOTES, EXPENSES, INVOICES, LEADS, LEAD_SOURCES,
  NOTIFS, OPNAME, PO_CLIENT, PRODUCTS, PROJECTS, PURCHASE_REQUESTS, QUOTATIONS, RECEIVING,
  ROLE_LABEL, SUPPLIERS, SUPPLIER_POS, SURVEYS, TASKS, USERS, WAREHOUSES,
  type Approval, type Notif, type Role, type Row, type User,
} from "@/mock/data";
import { MODULES } from "@/mock/modules";
import { BOS_THRESHOLD } from "@/tokens";
import { hoursAgo } from "@/lib/format";
import { ToastHost, type ToastItem } from "@/components/taska/toast";

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
  opname: Row[];
  users: Row[];
  "audit-log": Row[];
  [k: string]: Row[];
};
export type HistoryItem = { id: string; who: string; what: string; when: string };

type ApprovalState = Approval & { financeOk?: boolean };

type Ctx = {
  user: User | null;
  login: (role: Role) => void;
  logout: () => void;
  data: DB;
  addRow: (module: string, row: Record<string, any>) => Row;
  patchRow: (module: string, id: string, patch: Record<string, any>) => void;
  setStatus: (module: string, id: string, status: string, note?: string) => void;
  history: (module: string, id: string) => HistoryItem[];
  approvals: ApprovalState[];
  decide: (id: string, decision: "Disetujui" | "Ditolak", reason?: string) => void;
  notifs: Notif[];
  unread: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  toast: (msg: string, tone?: ToastItem["tone"]) => void;
  offline: boolean;
  setOffline: (v: boolean) => void;
};

const AppContext = React.createContext<Ctx | null>(null);

const DEFAULT_PRODUCT_CATEGORIES = [
  { id: "CAT-01", nama: "IP Camera", deskripsi: "Kamera pengawas CCTV berbasis IP network", prefix: "CAM", status: "Aktif" },
  { id: "CAT-02", nama: "NVR", deskripsi: "Network Video Recorder perekam rekaman kamera", prefix: "NVR", status: "Aktif" },
  { id: "CAT-03", nama: "Access Control", deskripsi: "Perangkat akses pintu, fingerprint & kartu RFID", prefix: "ACC", status: "Aktif" },
  { id: "CAT-04", nama: "Switch", deskripsi: "Switch PoE & Network Managed Distribution", prefix: "SW", status: "Aktif" },
  { id: "CAT-05", nama: "Server", deskripsi: "Server rackmount & workstation monitoring", prefix: "SRV", status: "Aktif" },
  { id: "CAT-06", nama: "UPS", deskripsi: "Uninterruptible Power Supply backup daya", prefix: "UPS", status: "Aktif" },
  { id: "CAT-07", nama: "Kabel", deskripsi: "Kabel UTP LAN Cat6, FO & Patch Cord", prefix: "CBL", status: "Aktif" },
  { id: "CAT-08", nama: "Aksesoris", deskripsi: "Bracket, RJ45, modular jack & perlengkapan instalasi", prefix: "ACC", status: "Aktif" },
];

const initialDB = (): DB => ({
  leads: LEADS, quotations: QUOTATIONS, surveys: SURVEYS, "po-client": PO_CLIENT, invoices: INVOICES,
  projects: PROJECTS, tasks: TASKS, "purchase-requests": PURCHASE_REQUESTS, "supplier-pos": SUPPLIER_POS,
  receiving: RECEIVING, "delivery-notes": DELIVERY_NOTES, expenses: EXPENSES, "damage-reports": DAMAGE_REPORTS,
  customers: CUSTOMERS, suppliers: SUPPLIERS, warehouses: WAREHOUSES, products: PRODUCTS,
  productCategories: DEFAULT_PRODUCT_CATEGORIES,
  leadSources: LEAD_SOURCES.map((ls, idx) => ({ id: `LS-${idx + 1}`, nama: ls, status: "Aktif" })),
  opname: OPNAME,
  users: USERS.map((u) => ({ ...u, roleLabel: ROLE_LABEL[u.role] })),
  "audit-log": AUDIT_LOG,
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [data, setData] = React.useState<DB>(initialDB);
  const [hist, setHist] = React.useState<Record<string, HistoryItem[]>>({});
  const [approvals, setApprovals] = React.useState<ApprovalState[]>(APPROVALS);
  const [notifs, setNotifs] = React.useState<Notif[]>(NOTIFS);
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const [offline, setOffline] = React.useState(false);
  const seq = React.useRef(100);

  const toast = React.useCallback((msg: string, tone: ToastItem["tone"] = "success") => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const login = React.useCallback((role: Role) => {
    setUser(USERS.find((u) => u.role === role) ?? USERS[0] ?? null);
  }, []);
  const logout = React.useCallback(() => setUser(null), []);

  const audit = React.useCallback(
    (aksi: string, jenis: string, refId: string) => {
      setData((d) => ({
        ...d,
        "audit-log": [
          { id: `AL-${++seq.current}`, waktu: new Date().toISOString(), pengguna: user?.name ?? "-", aksi, jenis, refId },
          ...(d["audit-log"] ?? []),
        ],
      }));
    },
    [user],
  );

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

  const addRow = React.useCallback(
    (module: string, row: Record<string, any>): Row => {
      const def = MODULES[module];
      const id = `${def?.idPrefix ?? "X"}-${String(Math.floor(Math.random() * 900) + 100)}`;
      const full: Row = { ...(def?.defaults ?? {}), tanggal: "2026-10-08", ...row, id };
      if (module === "users") full.role = row.roleLabel;
      setData((d) => ({ ...d, [module]: [full, ...(d[module] ?? [])] }));
      pushHistory(module, id, "Membuat data baru");
      audit(`Membuat ${def?.singular?.toLowerCase() ?? "data"}`, def?.singular ?? module, id);
      return full;
    },
    [audit, pushHistory],
  );

  const patchRow = React.useCallback((module: string, id: string, patch: Record<string, any>) => {
    setData((d) => ({ ...d, [module]: (d[module] ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  }, []);

  const setStatus = React.useCallback(
    (module: string, id: string, status: string, note?: string) => {
      const def = MODULES[module];
      const key = def?.statusKey || "status";
      setData((d) => ({
        ...d,
        [module]: (d[module] ?? []).map((r) => {
          if (r.id !== id) return r;
          const next: Row = { ...r, [key]: status };
          if (module === "leads" && status === "Lost") next.alasanLost = note ?? "";
          if (module === "leads" && status === "Won") next.peluang = 100;
          if (module === "invoices" && status === "Lunas") next.terbayar = r.total;
          return next;
        }),
      }));
      pushHistory(module, id, `Mengubah status menjadi ${status}${note ? ` (${note})` : ""}`);
      audit(`Mengubah status ke ${status}`, def?.singular ?? module, id);
      toast(`Status diubah ke ${status}`);
    },
    [audit, pushHistory, toast],
  );

  const history = React.useCallback(
    (module: string, id: string): HistoryItem[] => {
      const custom = hist[`${module}:${id}`] ?? [];
      const row = data[module]?.find((r) => r.id === id);
      const owner = row?.pemilik ?? row?.pembuat ?? row?.pemohon ?? row?.pelapor ?? row?.pm ?? "Sistem";
      return [
        ...custom,
        { id: "d1", who: owner, what: "Membuat data", when: hoursAgo(96) },
        { id: "d2", who: "Sistem", what: "Data tersambung ke dokumen terkait", when: hoursAgo(95) },
      ];
    },
    [hist, data],
  );

  const decide = React.useCallback(
    (id: string, decision: "Disetujui" | "Ditolak", reason?: string) => {
      const a = approvals.find((x) => x.id === id);
      if (!a || !user) return;
      const needsBos = a.nilai > BOS_THRESHOLD && user.role !== "bos";
      if (decision === "Disetujui" && needsBos) {
        setApprovals((l) => l.map((x) => (x.id === id ? { ...x, financeOk: true } : x)));
        pushHistory(a.module, a.refId, "Disetujui Finance, menunggu persetujuan Bos");
        toast("Disetujui. Menunggu persetujuan Bos karena nilainya besar");
        return;
      }
      setApprovals((l) => l.map((x) => (x.id === id ? { ...x, status: decision, alasan: reason } : x)));
      const field = a.module === "supplier-pos" || a.module === "delivery-notes" ? "persetujuan" : "status";
      const patch: Record<string, any> = { [field]: decision };
      if (a.module === "supplier-pos" && decision === "Disetujui") patch.status = "Disetujui";
      if (a.module === "quotations") patch.status = decision;
      if (data[a.module]) patchRow(a.module, a.refId, patch);
      pushHistory(a.module, a.refId, `${decision === "Disetujui" ? "Menyetujui" : "Menolak"} dokumen${reason ? `: ${reason}` : ""}`);
      audit(`${decision === "Disetujui" ? "Menyetujui" : "Menolak"} ${a.jenis.toLowerCase()}`, a.jenis, a.refId);
      toast(decision === "Disetujui" ? "Dokumen disetujui" : "Dokumen ditolak", decision === "Disetujui" ? "success" : "danger");
    },
    [approvals, user, data, patchRow, pushHistory, audit, toast],
  );

  const myNotifs = React.useMemo(
    () => notifs.filter((n) => n.roles === "all" || (user && n.roles.includes(user.role))),
    [notifs, user],
  );
  const unread = myNotifs.filter((n) => !n.baca).length;
  const markRead = React.useCallback((id: string) => setNotifs((l) => l.map((n) => (n.id === id ? { ...n, baca: true } : n))), []);
  const markAllRead = React.useCallback(() => setNotifs((l) => l.map((n) => ({ ...n, baca: true }))), []);

  const value = React.useMemo<Ctx>(
    () => ({
      user, login, logout, data, addRow, patchRow, setStatus, history, approvals, decide,
      notifs: myNotifs, unread, markRead, markAllRead, toast, offline, setOffline,
    }),
    [user, login, logout, data, addRow, patchRow, setStatus, history, approvals, decide, myNotifs, unread, markRead, markAllRead, toast, offline],
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
