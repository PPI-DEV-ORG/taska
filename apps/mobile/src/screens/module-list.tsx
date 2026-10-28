import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, Plus, Trash2, CreditCard } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { EmptyState, PageHeader, Chip } from "@/components/taska/basics";
import { DataTable, FilterBar } from "@/components/taska/data-table";
import { ConfirmDialog, FormDialog } from "@/components/taska/dialogs";
import { useApp } from "@/store/app-store";
import type { ModuleDef, Role, Row, User } from "@/constants/modules";
import { colors } from "@/tokens";
import {
  SupplierInvoiceDetailDialog,
  SupplierInvoicePayDialog,
} from "@/modules/supplier-po/supplier-invoice-dialogs";
import { SupplierPaymentTermsDialog } from "@/modules/supplier-po/supplier-payment-terms-dialog";
import { CreateInvoiceDialog } from "@/modules/invoice/create-invoice-dialog";
import { compareDesc } from "@/lib/format";

const CREATE: Record<string, Role[]> = {
  leads: ["sales", "pm"],
  quotations: ["sales", "pm"],
  surveys: ["sales", "pm"],
  "po-client": ["finance", "sales", "pm"],
  invoices: ["finance", "admin", "super_admin", "bos"],
  projects: ["pm", "sales", "finance"],
  "damage-reports": ["gudang", "sales", "procurement", "finance", "pm", "teknisi", "se"],
  customers: ["sales", "pm", "finance"],
  suppliers: ["procurement"],
  users: ["bos", "admin"],
};

export function canCreate(def: ModuleDef, role: Role) {
  if (role === "super_admin") return !!(def.newHref || def.createFields);
  // PRD Aturan: Bos / Admin hanya melihat dan menyetujui, tanpa tombol buat, ubah, atau hapus
  if ((role === "bos" || role === "admin") && def.key !== "users") return false;
  return (def.createRoles ?? CREATE[def.key] ?? []).includes(role) && !!(def.newHref || def.createFields);
}

const DELETE: Record<string, Role[]> = {
  leads: ["sales", "pm", "admin"],
  projects: ["pm", "admin"],
  customers: ["sales", "pm", "finance", "admin"],
  suppliers: ["procurement", "admin"],
  users: ["bos", "admin"],
  surveys: ["sales", "pm", "admin"],
  quotations: ["sales", "pm", "finance", "admin"],
  "po-client": ["finance", "sales", "pm", "admin"],
  invoices: ["finance", "sales", "pm", "admin"],
  "purchase-requests": ["pm", "procurement", "finance", "gudang", "admin"],
  "supplier-pos": ["procurement", "finance", "admin"],
  receiving: ["gudang", "procurement", "admin"],
  "delivery-notes": ["sales", "pm", "teknisi", "procurement", "finance", "gudang", "se", "admin"],
  expenses: ["sales", "pm", "teknisi", "procurement", "finance", "gudang", "se", "admin"],
  "damage-reports": ["gudang", "sales", "procurement", "finance", "pm", "admin"],
};

export function canDelete(def: ModuleDef, role: Role) {
  if (role === "super_admin") return true;
  return (DELETE[def.key] ?? []).includes(role);
}

function rowLabel(def: ModuleDef, row: Row): string {
  try {
    return def.titleOf(row) || row.name || row.nama || row.nomor || row.id;
  } catch {
    return String(row.name ?? row.nama ?? row.nomor ?? row.id);
  }
}

/** Batasi data yang dilihat per role (aturan lihat data di prompt bagian 6). */
export function scopeRows(def: ModuleDef, rows: Row[], u: User): Row[] {
  const role = (u.role || "").toLowerCase();
  if (role === "super_admin") return rows;
  if (role === "finance" || role === "bos" || role === "admin") {
    if (def.key === "surveys") return rows;
  }
  const mine = (v: unknown) => String(v ?? "").includes(u.name);
  switch (def.key) {
    case "quotations":
      return role === "sales" ? rows.filter((r) => r.pemilik === u.name) : rows;
    case "projects":
      return ["pm", "teknisi", "se"].includes(role) ? rows.filter((r) => r.pm === u.name || mine(r.tim)) : rows;
    case "tasks":
      return ["teknisi", "se"].includes(role)
        ? rows.filter((r) => r.pic === u.name || (r.assigneeId && String(r.assigneeId) === String(u.id)) || mine(r.pic))
        : rows;
    case "surveys":
      return ["teknisi", "se"].includes(role) ? rows.filter((r) => mine(r.tim)) : rows;
    case "delivery-notes":
      return ["super_admin", "bos", "admin", "finance", "gudang"].includes(role) ? rows : rows.filter((r) => r.pembuat === u.name);
    case "expenses":
      return ["super_admin", "bos", "admin", "finance"].includes(role)
        ? rows
        : rows.filter((r) => r.pelapor === u.name || (r.reporterId && String(r.reporterId) === String(u.id)));
    default:
      return rows;
  }
}

export function ModuleList({ def, title, headerExtra }: { def: ModuleDef; title?: string; headerExtra?: React.ReactNode }) {
  const router = useRouter();
  const { user, data, deleteRow, refreshModule } = useApp();
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [dateFilter, setDateFilter] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Row | null>(null);

  const fetchedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (def?.key && fetchedRef.current !== def.key) {
      fetchedRef.current = def.key;
      void refreshModule(def.key);
      if (def.key === "invoices" || def.key === "supplier-pos") void refreshModule("invoiceIn");
    }
  }, [def?.key, refreshModule]);

  const [invoiceTab, setInvoiceTab] = React.useState<"all" | "out" | "receipts" | "in">("all");
  const [poTab, setPoTab] = React.useState<"po" | "faktur" | "pembayaran">("po");
  const [damageTab, setDamageTab] = React.useState<"all" | "kerusakan" | "retur-sales" | "retur-purchase">("all");
  const [selectedSupplierInvoice, setSelectedSupplierInvoice] = React.useState<Row | null>(null);
  const [supplierPayTarget, setSupplierPayTarget] = React.useState<Row | null>(null);
  const [paymentTermsOpen, setPaymentTermsOpen] = React.useState(false);

  const clientReceipts = React.useMemo(() => {
    const list: Row[] = [];
    for (const inv of data.invoices ?? []) {
      const payments = Array.isArray(inv._payments) ? inv._payments : [];
      payments.forEach((p: any, idx: number) => {
        list.push({
          id: `rcp-${inv.id}-${p.id ?? idx}`,
          invoiceId: String(inv.id),
          nomor: p.reference && p.reference !== "-" ? `KW/${p.reference}` : `KW/${inv.nomor}/${idx + 1}`,
          invoiceNomor: inv.nomor,
          customer: inv.customer,
          jenis: `${p.method || "TRANSFER"} · ${inv.jenis || "Invoice"}`,
          total: Number(p.amount) || 0,
          terbayar: Number(p.amount) || 0,
          jatuhTempo: p.date || inv.tanggal,
          tanggal: p.date || inv.tanggal,
          status: "Lunas",
          direction: "receipt",
          fileId: p.fileId ?? null,
        });
      });
    }
    return list;
  }, [data.invoices]);

  const supplierPayments = React.useMemo(() => {
    const list: Row[] = [];
    for (const inv of data.invoiceIn ?? []) {
      const payments = Array.isArray(inv._payments) ? inv._payments : [];
      if (payments.length > 0) {
        payments.forEach((p: any, idx: number) => {
          list.push({
            ...inv,
            id: `spay-${inv.id}-${p.id ?? idx}`,
            rawId: (inv as any).rawId ?? inv.id,
            nomor: p.reference && p.reference !== "-" ? p.reference : `PAY-SUP/${inv.nomor}/${idx + 1}`,
            supplier: inv.supplier || inv.customer,
            item: `Faktur ${inv.nomor}${inv.po && inv.po !== "-" ? ` · PO ${inv.po}` : ""}`,
            total: Number(p.amount) || 0,
            eta: p.date || inv.tanggal,
            tanggal: p.date || inv.tanggal,
            status: "Lunas",
            direction: "in",
          });
        });
      } else if (Number(inv.terbayar) > 0) {
        list.push({
          ...inv,
          id: `spay-${inv.id}-0`,
          rawId: (inv as any).rawId ?? inv.id,
          nomor: `PAY-SUP/${inv.nomor}`,
          supplier: inv.supplier || inv.customer,
          item: `Faktur ${inv.nomor}${inv.po && inv.po !== "-" ? ` · PO ${inv.po}` : ""}`,
          total: Number(inv.terbayar) || 0,
          eta: inv.tanggal,
          tanggal: inv.tanggal,
          status: inv.status || "Dibayar sebagian",
          direction: "in",
        });
      }
    }
    return list;
  }, [data.invoiceIn]);

  const rows = React.useMemo(() => {
    let sourceRows = data[def.key] ?? [];
    if (def.key === "invoices") {
      const qList = data.quotations ?? [];
      const pList = data.projects ?? [];
      const qMap = new Map(qList.map((q) => [String(q.id), q]));
      const qNumMap = new Map(qList.map((q) => [String(q.nomor).toLowerCase(), q]));
      const pMap = new Map(pList.map((p) => [String(p.id), p]));
      const pNameMap = new Map(pList.map((p) => [String(p.nama).toLowerCase(), p]));

      const enrich = (r: Row) => {
        const matchedQ = qMap.get(String(r.quotationId)) || qNumMap.get(String(r.quotation || "").toLowerCase());
        const matchedP = pMap.get(String(r.projectId)) || pNameMap.get(String(r.project || "").toLowerCase());
        const lead = r.lead || matchedQ?.lead || matchedP?.lead || "";
        const quote = r.quotation || matchedQ?.nomor || matchedP?.penawaran || "";
        const proj = r.project || matchedP?.nama || "";
        const tot = Number(r.total) || 0;
        const paid = Number(r.terbayar) || 0;
        const isDp = r.jenis === "DP" || String(r.type).toUpperCase() === "DP";
        const isPaid = r.status === "Lunas" || r.status === "PAID" || (tot > 0 && paid >= tot);
        const isPartial = !isPaid && ((paid > 0 && paid < tot) || (isDp && paid > 0));
        const paymentNote = isPartial ? "dp setengah bayar setengah sebagian dp termin" : "";
        const currentStatus = isPaid ? "Lunas" : isPartial ? "Dibayar sebagian" : r.status;
        return { ...r, lead, quotation: quote, project: proj, paymentNote, status: currentStatus };
      };

      const invOut = (data.invoices ?? []).map((r) =>
        enrich({ ...r, id: String(r.id), direction: "out", tipeInvoice: "Invoice Masuk" })
      );
      const invIn = (data.invoiceIn ?? []).map((r: Row) => ({
        ...r,
        id: String(r.id).startsWith("in-") ? String(r.id) : `in-${r.id}`,
        rawId: (r as any).rawId ?? r.id,
        direction: "in",
        tipeInvoice: "Invoice Keluar",
        customer: r.supplier || r.customer,
      }));
      if (invoiceTab === "out") {
        sourceRows = invOut;
      } else if (invoiceTab === "in") {
        sourceRows = invIn;
      } else if (invoiceTab === "receipts") {
        sourceRows = clientReceipts;
      } else {
        sourceRows = [...invOut, ...invIn];
      }
    } else if (def.key === "supplier-pos") {
      if (poTab === "faktur") {
        sourceRows = (data.invoiceIn ?? []).map((r: Row) => ({
          ...r,
          id: String(r.id).startsWith("in-") ? String(r.id) : `in-${r.id}`,
          rawId: (r as any).rawId ?? r.id,
          nomor: r.nomor,
          supplier: r.supplier || String(r.customer || "").replace(/\s*\(Supplier\)$/i, ""),
          item: r.po && r.po !== "-" ? `PO: ${r.po} · Terbayar Rp ${(Number(r.terbayar) || 0).toLocaleString("id-ID")}` : `Tagihan Supplier`,
          total: Number(r.total) || 0,
          eta: r.jatuhTempo || r.tanggal,
          status: r.status || "Belum lunas",
          direction: "in",
        }));
      } else if (poTab === "pembayaran") {
        sourceRows = supplierPayments;
      }
    } else if (def.key === "damage-reports") {
      if (damageTab === "kerusakan") {
        sourceRows = sourceRows.filter((r: Row) => r.kategoriLaporan !== "Retur Penjualan" && r.kategoriLaporan !== "Retur Pembelian");
      } else if (damageTab === "retur-sales") {
        sourceRows = sourceRows.filter((r: Row) => r.kategoriLaporan === "Retur Penjualan" || r.jenis === "Retur Penjualan");
      } else if (damageTab === "retur-purchase") {
        sourceRows = sourceRows.filter((r: Row) => r.kategoriLaporan === "Retur Pembelian" || r.jenis === "Retur Pembelian");
      }
    }
    const scoped = scopeRows(def, sourceRows, user!);
    const s = q.trim().toLowerCase();
    return scoped
      .filter((r) => {
        if (!status) return true;
        if (def.key === "invoices") {
          const tot = Number(r.total) || 0;
          const paid = Number(r.terbayar) || 0;
          const isDp = r.jenis === "DP" || String(r.type).toUpperCase() === "DP";
          const isPaid = r[def.statusKey] === "Lunas" || r[def.statusKey] === "PAID" || (tot > 0 && paid >= tot);
          const isPartial = !isPaid && ((paid > 0 && paid < tot) || (isDp && paid > 0));
          if (status === "Dibayar sebagian") {
            return isPartial || (!isPaid && (r[def.statusKey] === "Dibayar sebagian" || r[def.statusKey] === "PARTIAL"));
          }
          if (status === "Lunas") {
            return isPaid;
          }
          if (status === "Belum lunas") {
            return !isPaid && r[def.statusKey] !== "BATAL" && r[def.statusKey] !== "Dibatalkan" && r[def.statusKey] !== "Batal";
          }
        }
        return r[def.statusKey] === status;
      })
      .filter((r) => {
        if (!s) return true;
        const matchesField = def.search.some((k) => String(r[k] ?? "").toLowerCase().includes(s));
        if (matchesField) return true;
        if (def.key === "suppliers" && Array.isArray(r.tags)) {
          return r.tags.some((t: any) => String(t.itemName || t.nama || "").toLowerCase().includes(s));
        }
        return false;
      })
      .filter((r) => {
        if (!dateFilter) return true;
        const target = dateFilter.slice(0, 10);
        const candidates = [
          r.tanggal,
          r.closing,
          r.jadwal,
          r.jatuhTempo,
          r.waktu,
          r.eta,
          r.dibutuhkan,
          r.tenggat,
          r.createdAt,
          r.updatedAt,
          r.timestamp,
          r.date,
        ];
        return candidates.some((c) => {
          if (!c) return false;
          const str = String(c);
          return str.startsWith(target) || str.includes(target);
        });
      })
      .map((r) => {
        if (def.key === "quotations") {
          return {
            ...r,
            fileStatus: r.fileUploaded ? "Sudah Diupload" : "Belum Ada File",
          };
        }
        return r;
      })
      .sort(compareDesc);
  }, [def, data, user, q, status, dateFilter, invoiceTab, poTab, damageTab, clientReceipts, supplierPayments]);

  const activeColumns = React.useMemo(() => {
    if (def.key === "invoices") {
      if (invoiceTab === "receipts") {
        return [
          { key: "nomor", label: "No. Receipt / Kwitansi", primary: true, flex: 1.5 },
          { key: "invoiceNomor", label: "No. Invoice", flex: 1.3 },
          { key: "customer", label: "Customer", flex: 1.5 },
          { key: "jenis", label: "Metode & Jenis", flex: 1.3 },
          { key: "total", label: "Nominal Diterima", fmt: "rupiah" as const },
          { key: "tanggal", label: "Tanggal Bayar", fmt: "date" as const },
          { key: "status", label: "Status", fmt: "status" as const, mobile: true },
        ];
      }
      return [
        { key: "nomor", label: "Nomor", primary: true, flex: 1.4 },
        { key: "tipeInvoice", label: "Tipe", flex: 1.1 },
        { key: "customer", label: "Pihak (Customer/Supplier)", flex: 1.6 },
        { key: "jenis", label: "Jenis" },
        { key: "total", label: "Total", fmt: "rupiah" as const },
        { key: "terbayar", label: "Terbayar", fmt: "rupiah" as const },
        { key: "jatuhTempo", label: "Jatuh tempo", fmt: "date" as const },
        { key: "status", label: "Status", fmt: "status" as const, mobile: true },
      ];
    }
    if (def.key === "supplier-pos" && poTab === "faktur") {
      return [
        { key: "nomor", label: "No. Faktur Supplier", primary: true, flex: 1.4 },
        { key: "supplier", label: "Supplier", flex: 1.6 },
        { key: "item", label: "Referensi PO & Bayar", flex: 1.8 },
        { key: "total", label: "Total Tagihan", fmt: "rupiah" as const },
        { key: "eta", label: "Jatuh Tempo", fmt: "date" as const },
        { key: "status", label: "Status", fmt: "status" as const, mobile: true },
      ];
    }
    if (def.key === "supplier-pos" && poTab === "pembayaran") {
      return [
        { key: "nomor", label: "No. Bukti / Ref Bayar", primary: true, flex: 1.4 },
        { key: "supplier", label: "Supplier", flex: 1.6 },
        { key: "item", label: "Faktur & PO Terkait", flex: 1.8 },
        { key: "total", label: "Nominal Dibayar", fmt: "rupiah" as const },
        { key: "eta", label: "Tanggal Bayar", fmt: "date" as const },
        { key: "status", label: "Status", fmt: "status" as const, mobile: true },
      ];
    }
    return def.columns;
  }, [def.key, def.columns, invoiceTab, poTab]);

  const allowed = canCreate(def, user!.role);
  const deleteAllowed = canDelete(def, user!.role);
  const canManagePaymentTerms = def.key === "suppliers" && ["super_admin", "admin", "bos", "procurement", "finance"].includes(user!.role);

  const action = allowed ? (
    <View className="flex-row items-center gap-2">
      {canManagePaymentTerms ? (
        <Button variant="outline" onPress={() => setPaymentTermsOpen(true)} className="gap-1.5 h-10 px-3">
          <CreditCard size={15} color={colors.primary} />
          <Text className="text-xs font-semibold">Atur Syarat Pembayaran</Text>
        </Button>
      ) : null}
      <Button onPress={() => (def.newHref ? router.push(def.newHref as any) : setOpen(true))}>
        <Plus size={16} color={colors.background} />
        <Text>{def.createLabel ?? `Tambah ${def.singular}`}</Text>
      </Button>
    </View>
  ) : canManagePaymentTerms ? (
    <Button variant="outline" onPress={() => setPaymentTermsOpen(true)} className="gap-1.5 h-10 px-3">
      <CreditCard size={15} color={colors.primary} />
      <Text className="text-xs font-semibold">Atur Syarat Pembayaran</Text>
    </Button>
  ) : undefined;

  const isMasterOrSub = ["customers", "suppliers", "users"].includes(def.key);

  return (
    <>
      <PageHeader
        back={isMasterOrSub}
        title={title ?? def.title}
        subtitle={`${rows.length} data`}
        action={action}
      />
      {headerExtra}
      {def.key === "invoices" ? (
        <View className="flex-row flex-wrap items-center gap-2 mb-3">
          <Chip
            label={`Semua (${(data.invoices?.length || 0) + (data.invoiceIn?.length || 0)})`}
            active={invoiceTab === "all"}
            onPress={() => setInvoiceTab("all")}
          />
          <Chip
            label={`Invoice Masuk (${data.invoices?.length || 0})`}
            active={invoiceTab === "out"}
            onPress={() => setInvoiceTab("out")}
          />
          <Chip
            label={`Invoice Keluar (${data.invoiceIn?.length || 0})`}
            active={invoiceTab === "in"}
            onPress={() => setInvoiceTab("in")}
          />
          <Chip
            label={`Receipt / Kwitansi (${clientReceipts.length})`}
            active={invoiceTab === "receipts"}
            onPress={() => setInvoiceTab("receipts")}
          />
        </View>
      ) : null}
      {def.key === "supplier-pos" ? (
        <View className="flex-row flex-wrap items-center gap-2 mb-3">
          <Chip
            label={`Pesanan Pembelian / PO (${data["supplier-pos"]?.length || 0})`}
            active={poTab === "po"}
            onPress={() => setPoTab("po")}
          />
          <Chip
            label={`Faktur Pembelian / Tagihan (${data.invoiceIn?.length || 0})`}
            active={poTab === "faktur"}
            onPress={() => setPoTab("faktur")}
          />
          <Chip
            label={`Pembayaran Pembelian (${supplierPayments.length})`}
            active={poTab === "pembayaran"}
            onPress={() => setPoTab("pembayaran")}
          />
        </View>
      ) : null}
      {def.key === "damage-reports" ? (
        <View className="flex-row flex-wrap items-center gap-2 mb-3">
          <Chip
            label={`Semua (${data["damage-reports"]?.length || 0})`}
            active={damageTab === "all"}
            onPress={() => setDamageTab("all")}
          />
          <Chip
            label="Laporan Kerusakan"
            active={damageTab === "kerusakan"}
            onPress={() => setDamageTab("kerusakan")}
          />
          <Chip
            label="Retur Penjualan (Customer)"
            active={damageTab === "retur-sales"}
            onPress={() => setDamageTab("retur-sales")}
          />
          <Chip
            label="Retur Pembelian (Supplier)"
            active={damageTab === "retur-purchase"}
            onPress={() => setDamageTab("retur-purchase")}
          />
        </View>
      ) : null}
      <FilterBar
        search={q}
        onSearch={setQ}
        statuses={def.statuses}
        status={status}
        onStatus={setStatus}
        date={dateFilter}
        onDate={setDateFilter}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={def.icon}
          title={q || status || dateFilter ? "Tidak ada yang cocok" : `Belum ada ${def.singular.toLowerCase()}`}
          text={q || status || dateFilter ? "Coba ubah kata kunci, filter tanggal, atau filter status." : def.emptyText}
          actionLabel={q || status || dateFilter ? "Reset filter" : allowed ? def.createLabel : undefined}
          onAction={() => {
            if (q || status || dateFilter) {
              setQ("");
              setStatus("");
              setDateFilter("");
            } else if (def.newHref) {
              router.push(def.newHref as any);
            } else {
              setOpen(true);
            }
          }}
        />
      ) : (
        <DataTable
          columns={activeColumns}
          rows={rows}
          onRowPress={(r) => {
            if ((def.key === "invoices" || def.key === "supplier-pos") && r.direction === "in") {
              setSelectedSupplierInvoice(r);
            } else if (def.key === "invoices" && r.direction === "receipt" && r.invoiceId) {
              router.push(`/invoices/${r.invoiceId}` as any);
            } else {
              router.push(`/${def.key}/${r.id}` as any);
            }
          }}
          actionsWidth={deleteAllowed ? 104 : 64}
          renderActions={deleteAllowed ? (r) => (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg hover:bg-panel"
                onPress={() => {
                  if ((def.key === "invoices" || def.key === "supplier-pos") && r.direction === "in") {
                    setSelectedSupplierInvoice(r);
                  } else if (def.key === "invoices" && r.direction === "receipt" && r.invoiceId) {
                    router.push(`/invoices/${r.invoiceId}` as any);
                  } else {
                    router.push(`/${def.key}/${r.id}` as any);
                  }
                }}
              >
                <ChevronRight size={16} color={colors.muted} />
              </Button>
              {r.direction !== "receipt" ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-lg hover:bg-danger/10"
                  onPress={() => setDeleteTarget(r)}
                >
                  <Trash2 size={15} color={colors.danger} />
                </Button>
              ) : null}
            </>
          ) : undefined}
        />
      )}
      {def.key === "invoices" ? (
        <CreateInvoiceDialog open={open} onOpenChange={setOpen} />
      ) : def.createFields ? (
        <FormDialog def={def} open={open} onOpenChange={setOpen} />
      ) : null}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`Hapus ${def.singular.toLowerCase()} ini?`}
        description={`Data "${deleteTarget ? rowLabel(def, deleteTarget) : ""}" akan dihapus setelah kamu mengonfirmasi. Tindakan ini mengikuti aturan hapus dari server.`}
        confirmLabel="Ya, hapus"
        destructive
        onConfirm={() => {
          if (!deleteTarget) return;
          const targetModule = (def.key === "invoices" || def.key === "supplier-pos") && deleteTarget.direction === "in" ? "invoiceIn" : def.key;
          const targetId = deleteTarget.direction === "in" && (deleteTarget as any).rawId ? (deleteTarget as any).rawId : deleteTarget.id;
          void deleteRow(targetModule, targetId).then((ok) => {
            if (ok) setDeleteTarget(null);
          });
        }}
      />

      <SupplierInvoiceDetailDialog
        open={!!selectedSupplierInvoice}
        onOpenChange={(v) => !v && setSelectedSupplierInvoice(null)}
        invoice={selectedSupplierInvoice}
        canPay={user?.role === "super_admin" || user?.role === "finance" || user?.role === "bos" || user?.role === "admin"}
        onPayPress={(inv) => setSupplierPayTarget(inv)}
        onOpenPo={(poId) => router.push(`/supplier-pos/${poId}` as any)}
      />

      <SupplierInvoicePayDialog
        open={!!supplierPayTarget}
        onOpenChange={(v) => !v && setSupplierPayTarget(null)}
        invoice={supplierPayTarget}
        onSuccess={() => {
          setSelectedSupplierInvoice(null);
        }}
      />

      <SupplierPaymentTermsDialog
        open={paymentTermsOpen}
        onOpenChange={setPaymentTermsOpen}
      />
    </>
  );
}
