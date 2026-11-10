import * as React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Check, ChevronDown, Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, FormField, InfoGrid, PageHeader, Panel, Timeline, Cell } from "@/components/taska/basics";
import { ApprovalBar, ConfirmDialog, DatePicker, SearchableSelect, MultiSelect, getDynamicOptions, formatThousands, QuickAddCustomerDialog, QuickAddSupplierDialog } from "@/components/taska/dialogs";
import {
  CustomerSelect,
  LeadSelect,
  ProjectSelect,
  QuotationSelect,
  PoClientSelect,
  SurveySelect,
  PocSelect,
  VisitSelect,
} from "@/components/taska/document-select";
import { SupplierSelect } from "@/components/taska/supplier-select";
import { DocumentViewerList } from "@/components/taska/document-viewer";
import { StatusBadge } from "@/components/taska/status-badge";
import { ModuleExtras } from "@/screens/module-extras";
import { downloadQuotationTemplate } from "@/modules/quotation/quotation-files";
import { QuotationPpnField } from "@/modules/quotation/quotation-ppn-field";
import { QuotationPphField } from "@/modules/quotation/quotation-pph-field";
import {
  calcQuotationFinancials,
  calcItemPph,
  getInitialPpnMode,
  ppnModeToTipe,
  getInitialPphMode,
  pphModeToTipe,
  pphRateFor,
  type PpnMode,
  type PphMode,
} from "@/modules/quotation/lib";
import { useApp } from "@/store/app-store";
import { CAN_APPROVE, MODULES, type ModuleAction, type Row, type CreateField } from "@/constants/modules";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { PATHS, adaptRow, toEnum } from "@/services/adapters";
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { rupiah } from "@/lib/format";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { Portal } from "@rn-primitives/portal";

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function get30DaysLaterIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export function ModuleDetail({ moduleKey, id }: { moduleKey: string; id: string }) {
  const router = useRouter();
  const { data, user, addRow, patchRow, deleteRow, setStatus, history, loadHistory, approvals, decide, toast } = useApp();
  const { bp, isMobile } = useBreakpoint();
  const def = MODULES[moduleKey];
  const rowFromStore = data[moduleKey]?.find((r: { id: string }) => r.id === id);
  const [remoteRow, setRemoteRow] = React.useState<Row | null>(null);

  const [refreshIndex, setRefreshIndex] = React.useState(0);
  const handleRefresh = React.useCallback(async () => {
    setRefreshIndex((i) => i + 1);
    const path = PATHS[moduleKey];
    if (!path || !id || String(id).startsWith("offline-")) return;
    try {
      const res = await api<any>("GET", `${path}/${id}`);
      if (res) {
        const adapted = adaptRow(moduleKey, res);
        setRemoteRow(adapted);
      }
    } catch {}
    void loadHistory(moduleKey, id);
  }, [moduleKey, id, loadHistory]);

  React.useEffect(() => {
    if (moduleKey && id && !String(id).startsWith("offline-")) {
      void loadHistory(moduleKey, id);
    }
  }, [moduleKey, id, refreshIndex, loadHistory]);

  React.useEffect(() => {
    const path = PATHS[moduleKey];
    if (!path || !id || String(id).startsWith("offline-")) return;
    let active = true;
    api<any>("GET", `${path}/${id}`)
      .then((res) => {
        if (!res || !active) return;
        const adapted = adaptRow(moduleKey, res);
        setRemoteRow(adapted);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [moduleKey, id, refreshIndex, rowFromStore]);

  const row = React.useMemo(() => {
    if (!remoteRow) return rowFromStore;
    if (!rowFromStore) return remoteRow;
    return {
      ...remoteRow,
      ...rowFromStore,
      items: Array.isArray(rowFromStore.items) && rowFromStore.items.length > 0 ? rowFromStore.items : (remoteRow.items ?? rowFromStore.items),
      _payments: Array.isArray(rowFromStore._payments) && rowFromStore._payments.length > 0 ? rowFromStore._payments : (remoteRow._payments ?? rowFromStore._payments),
      _followUps: Array.isArray(rowFromStore._followUps) && rowFromStore._followUps.length > 0 ? rowFromStore._followUps : (remoteRow._followUps ?? rowFromStore._followUps),
      files: Array.isArray(rowFromStore.files) && rowFromStore.files.length > 0 ? rowFromStore.files : (remoteRow.files ?? rowFromStore.files),
      versions: Array.isArray(remoteRow.versions) && remoteRow.versions.length > 0 ? remoteRow.versions : rowFromStore.versions,
      ...(rowFromStore.status ? { status: rowFromStore.status, rawStatus: toEnum(moduleKey, rowFromStore.status) || rowFromStore.status } : {}),
    };
  }, [remoteRow, rowFromStore, moduleKey]);
  const lostReasons: string[] = (data.lostReasons ?? []).map((r: any) => String(r.nama)).filter(Boolean);
  const [menu, setMenu] = React.useState(false);
  const [pending, setPending] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [approveExpenseOpen, setApproveExpenseOpen] = React.useState(false);
  const [rejectExpenseOpen, setRejectExpenseOpen] = React.useState(false);
  const [expenseTransferNote, setExpenseTransferNote] = React.useState("");
  const [expenseFundSource, setExpenseFundSource] = React.useState<string>("Kas Kecil");
  const [submittingExpense, setSubmittingExpense] = React.useState(false);
  const expenseFileHandle = React.useRef<FileUploaderHandle | null>(null);
  const [deliveryDocOpen, setDeliveryDocOpen] = React.useState(false);
  const [deliveryDocFileId, setDeliveryDocFileId] = React.useState<number | null>(null);
  const [deliveryDocReport, setDeliveryDocReport] = React.useState("");
  const [deliveryDocTargetStatus, setDeliveryDocTargetStatus] = React.useState<"Dikirim" | "Diterima">("Dikirim");
  const [submittingDeliveryDoc, setSubmittingDeliveryDoc] = React.useState(false);
  const [quickCustomerKey, setQuickCustomerKey] = React.useState<string | null>(null);
  const [quickSupplierKey, setQuickSupplierKey] = React.useState<string | null>(null);

  const editableFields: CreateField[] = React.useMemo(() => {
    if (!def) return [];
    let raw = def.createFields?.length
      ? def.createFields
      : def.fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: (f.fmt === "rupiah" || f.fmt === "number" ? "number" : f.fmt === "date" ? "date" : "text") as any,
        }));
    if (moduleKey === "suppliers") {
      raw = raw.filter((f) => f.key !== "tagInput" && f.key !== "tagSummary" && f.key !== "tags");
    }
    return raw.filter((f) => f.type !== "file");
  }, [def, moduleKey]);

  const editableKeySet = React.useMemo(() => new Set(editableFields.map((f) => f.key)), [editableFields]);
  const readOnlyFields = React.useMemo(() => {
    if (!def || moduleKey === "poc-reports") return [];
    return def.fields.filter((f) => {
      if (editableKeySet.has(f.key) || f.key === def.statusKey) return false;
      if (moduleKey === "suppliers" && (f.key === "tagSummary" || f.key === "tagInput" || f.key === "tags")) return false;
      return true;
    });
  }, [def, editableKeySet, moduleKey]);

  const getInitialFieldValue = React.useCallback(
    (f: CreateField, r: Row) => {
      if (f.type === "password") return "";
      let rawVal = r[f.key];
      if (moduleKey === "supplier-pos" && f.key === "item" && rawVal) {
        rawVal = String(rawVal).replace(/\s*x\s*\d+.*$/, "").trim();
      }
      if (f.key === "pocReport" || f.key === "poc" || f.key === "pocId" || f.key === "pocReportId") {
        const pId = r.pocReportId ?? r.pocId;
        const pocList = (data?.["poc-reports"] ?? []);
        const match = pocList.find(
          (p: any) =>
            (pId != null && String(p.id) === String(pId)) ||
            (rawVal && rawVal !== "-" && (
              p.nomor === rawVal ||
              p.number === rawVal ||
              `POC ${p.nomor || p.number} - ${p.judul || p.title}` === rawVal
            ))
        );
        if (match) {
          return `POC ${match.nomor || match.number} - ${match.judul || match.title}`;
        }
      }
      if (f.key === "survey" || f.key === "surveyId") {
        const sId = r.surveyId;
        const match = (data?.surveys ?? []).find(
          (s: any) =>
            (sId != null && String(s.id) === String(sId)) ||
            (rawVal && rawVal !== "-" && (
              String(s.id) === String(rawVal) ||
              `Survey #${s.id} - ${s.lead || s.customer || s.lokasi || "Survey"}` === rawVal
            ))
        );
        if (match) {
          return `Survey #${match.id} - ${match.lead || match.customer || match.lokasi || "Survey"}`;
        }
      }
      if (f.key === "project" || f.key === "projectId") {
        const pId = r.projectId;
        const match = (data?.projects ?? []).find(
          (p: any) => (pId != null && String(p.id) === String(pId)) || (rawVal && rawVal !== "-" && (p.nama === rawVal || p.name === rawVal))
        );
        if (match) {
          return String(match.nama || match.name);
        }
      }
      if (f.key === "penawaran" || f.key === "quotation" || f.key === "quotationId") {
        const qId = r.quotationId;
        const match = (data?.quotations ?? []).find(
          (q: any) =>
            (qId != null && String(q.id) === String(qId)) ||
            (rawVal && rawVal !== "-" && (
              q.nomor === rawVal ||
              q.number === rawVal ||
              `${q.nomor} - ${q.customer || "-"} - ${q.lead || q.nama || "-"}` === rawVal
            ))
        );
        if (match) {
          return `${match.nomor || match.number} - ${match.customer || "-"} - ${match.lead || match.nama || "-"}`;
        }
      }
      if (f.key === "po" || f.key === "clientPo" || f.key === "clientPoId") {
        const poId = r.clientPoId;
        const match = (data?.["po-client"] ?? []).find(
          (p: any) =>
            (poId != null && String(p.id) === String(poId)) ||
            (rawVal && rawVal !== "-" && (
              p.nomor === rawVal ||
              p.nomorPoClient === rawVal ||
              p.number === rawVal
            ))
        );
        if (match) {
          return match.nomor || match.number || match.nomorPoClient || "";
        }
      }
      if (f.key === "visitReport" || f.key === "visit" || f.key === "visitId" || f.key === "visitReportId") {
        const vId = r.visitReportId ?? r.visitId;
        const match = (data?.["visit-reports"] ?? []).find(
          (v: any) =>
            (vId != null && String(v.id) === String(vId)) ||
            (rawVal && rawVal !== "-" && (
              v.nomor === rawVal ||
              v.number === rawVal ||
              `VISIT ${v.nomor || v.number} - ${v.judul || v.title}` === rawVal
            ))
        );
        if (match) {
          return `VISIT ${match.nomor || match.number} - ${match.judul || match.title}`;
        }
      }
      if (f.key === "lead" || f.key === "leadId") {
        const lId = r.leadId;
        const match = (data?.leads ?? []).find(
          (l: any) =>
            (lId != null && String(l.id) === String(lId)) ||
            (rawVal && rawVal !== "-" && (
              l.nama === rawVal ||
              l.name === rawVal ||
              `${l.nama || l.name} · ${l.perusahaan || l.customer}` === rawVal
            ))
        );
        if (match) {
          const name = match.nama || match.name || "";
          const comp = match.perusahaan || match.customer || "";
          return comp ? `${name} · ${comp}` : name;
        }
      }
      if (rawVal != null && rawVal !== "-") {
        return f.type === "number" ? formatThousands(String(rawVal)) : String(rawVal);
      }
      return "";
    },
    [moduleKey, data]
  );

  const [edits, setEdits] = React.useState<Record<string, any>>({});
  const [errs, setErrs] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [fallbackUsers, setFallbackUsers] = React.useState<any[]>([]);
  const [invoicePayOpen, setInvoicePayOpen] = React.useState(false);

  const initialQuotationPpnMode = React.useMemo<PpnMode>(() => getInitialPpnMode(row), [row]);
  const quotationPpnMode: PpnMode = (edits.ppnMode as PpnMode) ?? initialQuotationPpnMode;

  const initialQuotationPphMode = React.useMemo<PphMode>(() => getInitialPphMode(row), [row]);
  const quotationPphMode: PphMode = (edits.pphMode as PphMode) ?? initialQuotationPphMode;

  const [quotationDiscType, setQuotationDiscType] = React.useState<"nominal" | "percent">("nominal");
  const [quotationDiscPercent, setQuotationDiscPercent] = React.useState<string>("");

  function setQuotationPpnMode(mode: PpnMode) {
    setFieldValue("ppnMode", mode);
  }

  function setQuotationPphMode(mode: PphMode) {
    setFieldValue("pphMode", mode);
  }

  const quotationFinancials = React.useMemo(() => {
    if (moduleKey !== "quotations" || !row) {
      return { totNum: 0, discNum: 0, dpp: 0, ppn: 0, pph: 0, totalAfterDisc: 0 };
    }
    const nilaiRaw = "nilai" in edits ? edits.nilai : (row.nilai || row.total || 0);
    const discRaw = "disc" in edits ? edits.disc : (row.disc || 0);
    const rowItems = Array.isArray(row.items) ? row.items : [];
    return calcQuotationFinancials(nilaiRaw, discRaw, quotationPpnMode, quotationPphMode, rowItems);
  }, [moduleKey, edits, row, quotationPpnMode, quotationPphMode]);

  const invoiceFinancials = React.useMemo(() => {
    if (moduleKey !== "invoices" || !row) {
      return { amt: 0, dpp: 0, ppn: 0, pph: 0, total: 0 };
    }
    const nilaiRaw = "nilai" in edits ? edits.nilai : (row.nilai || row.amount || 0);
    const amt = Number(String(nilaiRaw).replace(/\D/g, "")) || 0;
    const ppnMode = quotationPpnMode;
    const pphMode = quotationPphMode;
    const isInclude = ppnMode === "include";
    const dpp = isInclude ? Math.round(amt / 1.11) : amt;
    const ppn = ppnMode === "none" ? 0 : isInclude ? Math.max(0, amt - dpp) : Math.round(amt * 0.11);
    const rowItems = Array.isArray(row.items) ? row.items : [];
    const itemPph = rowItems.reduce((acc: number, it: any) => acc + calcItemPph(it), 0);
    const pph = rowItems.length > 0 ? itemPph : Math.round(dpp * pphRateFor(pphMode));
    const total = Math.max(0, (isInclude ? amt : amt + ppn) - pph);
    return { amt, dpp, ppn, pph, total };
  }, [moduleKey, edits, row, quotationPpnMode, quotationPphMode]);

  React.useEffect(() => {
    if (!data.users || data.users.length === 0) {
      api<any[]>("GET", "/users/options")
        .then((res) => {
          if (Array.isArray(res) && res.length) setFallbackUsers(res);
        })
        .catch(() => {});
    }
  }, [data.users]);

  function getFieldValue(f: CreateField) {
    if (!row) return "";
    if (f.key in edits) return edits[f.key];
    return getInitialFieldValue(f, row);
  }

  function setFieldValue(key: string, val: any) {
    setEdits((prev) => ({ ...prev, [key]: val }));
    setErrs((e) => ({ ...e, [key]: "" }));
  }

  const isFinanceOrBos = ["finance", "bos", "super_admin", "admin"].includes(user?.role ?? "");
  const isReporter = !row?.reporterId || String(row?.reporterId) === String(user?.id) || row?.pelapor === user?.name;
  const canEditExpense = isFinanceOrBos || (["sales", "procurement", "admin", "pm", "teknisi", "se", "gudang"].includes(user?.role ?? "") && isReporter && row?.status !== "Dibayar");
  const canEdit = moduleKey === "expenses"
    ? canEditExpense
    : moduleKey === "invoices"
    ? isFinanceOrBos || ["sales", "pm"].includes(user?.role ?? "")
    : moduleKey === "supplier-pos"
    ? isFinanceOrBos || ["procurement", "gudang"].includes(user?.role ?? "")
    : moduleKey === "receiving"
    ? isFinanceOrBos || ["gudang", "procurement"].includes(user?.role ?? "")
    : true;
  const canDelete =
    user?.role === "super_admin"
      ? true
      : moduleKey === "expenses"
      ? isFinanceOrBos || (["sales", "procurement", "admin", "pm", "teknisi", "se", "gudang"].includes(user?.role ?? "") && isReporter && row?.status !== "Dibayar")
      : moduleKey === "surveys" && user?.role === "finance"
      ? false
      : moduleKey === "supplier-pos" && !["super_admin", "admin", "bos", "finance", "procurement"].includes(user?.role ?? "")
      ? false
      : moduleKey === "receiving" && !["super_admin", "admin", "bos", "gudang", "procurement"].includes(user?.role ?? "")
      ? false
      : true;

  const isDirty = React.useMemo(() => {
    if (!row || !canEdit) return false;
    if (
      (moduleKey === "quotations" || moduleKey === "invoices") &&
      (("ppnMode" in edits && edits.ppnMode !== initialQuotationPpnMode) ||
        ("pphMode" in edits && edits.pphMode !== initialQuotationPphMode))
    )
      return true;
    return editableFields.some((f) => {
      if (!(f.key in edits)) return false;
      if (f.type === "password") return Boolean(edits[f.key]?.trim());
      const current = String(edits[f.key] ?? "");
      const original = getInitialFieldValue(f, row);
      return current !== original;
    });
  }, [
    editableFields,
    edits,
    row,
    canEdit,
    moduleKey,
    initialQuotationPpnMode,
    initialQuotationPphMode,
    getInitialFieldValue,
  ]);

  const floatingStyle = React.useMemo<any>(() => {
    const left = isMobile ? 0 : bp === "tablet" ? 76 : 256;
    const bottom = isMobile ? 64 : 0;
    return {
      position: "absolute",
      left,
      right: 0,
      bottom,
      zIndex: 9999,
    };
  }, [isMobile, bp]);

  function handleReset() {
    setEdits({});
    setErrs({});
  }

  async function handleSaveForm() {
    if (!def || !row) return;
    const e: Record<string, string> = {};
    editableFields.forEach((f) => {
      if (f.type === "password") return;
      const val = f.key in edits ? edits[f.key] : getInitialFieldValue(f, row);
      if (f.required && !String(val ?? "").trim()) {
        e[f.key] = "Wajib diisi.";
      }
    });
    setErrs(e);
    if (Object.keys(e).length > 0) {
      toast("Harap lengkapi kolom yang wajib diisi", "danger");
      return;
    }

    const patch: Record<string, any> = {};
    editableFields.forEach((f) => {
      if (f.type === "password") {
        if (edits[f.key]?.trim()) patch[f.key] = edits[f.key].trim();
        return;
      }
      const raw = f.key in edits ? edits[f.key] : getInitialFieldValue(f, row);
      if (f.type === "number") {
        patch[f.key] = Number(String(raw ?? "0").replace(/\D/g, ""));
      } else if (f.type === "multiselect") {
        patch[f.key] = Array.isArray(raw) ? raw.join(", ") : raw ?? "";
      } else if (f.type === "date") {
        const str = String(raw ?? "").trim();
        patch[f.key] = str && str !== "-" ? str : undefined;
      } else {
        patch[f.key] = raw ?? "";
      }
    });

    if (moduleKey === "quotations") {
      const { totNum, discNum, ppn, pph, totalAfterDisc } = quotationFinancials;
      patch.total = totNum;
      patch.nilai = totNum;
      patch.disc = discNum;
      patch.ppn = ppn;
      patch.pph = pph;
      patch.totalAfterDisc = totalAfterDisc;
      patch.ppnMode = quotationPpnMode;
      patch.tipePpn = ppnModeToTipe(quotationPpnMode);
      if (totalAfterDisc > 0 && row.status === "Not Yet") {
        patch.status = "Done";
      }
    }

    if (moduleKey === "invoices") {
      const { dpp, ppn, pph, total } = invoiceFinancials;
      patch.amount = dpp;
      patch.nilai = dpp;
      patch.ppn = ppn;
      patch.pph = pph;
      patch.total = total;
      patch.ppnMode = quotationPpnMode;
      patch.tipePpn = ppnModeToTipe(quotationPpnMode);
      patch.pphMode = quotationPphMode;
      patch.tipePph = pphModeToTipe(quotationPphMode);
    }

    if (moduleKey === "damage-reports" && patch.po) {
      patch.po = (String(patch.po).split(" - ")[0] ?? "").trim();
    }

    if ((moduleKey === "supplier-pos" || moduleKey === "po-client") && patch.supplier) {
      const cleanSupp = (String(patch.supplier).split(" - ")[0] ?? "").trim();
      const suppList = (data.suppliers ?? []);
      const match = suppList.find(
        (s: any) => {
          const sName = String(s.nama || s.name || "").trim().toLowerCase();
          return sName === String(patch.supplier).trim().toLowerCase() || sName === cleanSupp.toLowerCase();
        }
      );
      if (match?.id) {
        patch.supplierId = Number(match.id);
      }
      patch.supplier = cleanSupp;
    }

    if (edits.leadId !== undefined) patch.leadId = edits.leadId;
    if (edits.projectId !== undefined) patch.projectId = edits.projectId;
    if (edits.quotationId !== undefined) patch.quotationId = edits.quotationId;
    if (edits.clientPoId !== undefined) patch.clientPoId = edits.clientPoId;
    if (edits.surveyId !== undefined) patch.surveyId = edits.surveyId;
    if (edits.pocReportId !== undefined) patch.pocReportId = edits.pocReportId;
    if (edits.visitReportId !== undefined) patch.visitReportId = edits.visitReportId;

    setSaving(true);
    try {
      await patchRow(moduleKey, id, patch);
      setEdits({});
      toast(`${def.singular} berhasil disimpan`);
      const path = PATHS[moduleKey];
      if (path) {
        const fresh = await api<any>("GET", `${path}/${id}`).catch(() => null);
        if (fresh) setRemoteRow(adaptRow(moduleKey, fresh));
      }
    } catch (err: any) {
      toast(err?.message || "Gagal menyimpan perubahan", "danger");
    } finally {
      setSaving(false);
    }
  }

  const isLead = moduleKey === "leads";

  const leadQuotation = React.useMemo(() => {
    if (!isLead || !row) return null;
    return (data.quotations ?? []).find(
      (q: Row) => (q.leadId && String(q.leadId) === String(row.id)) || (q.lead && q.lead.toLowerCase() === row.nama?.toLowerCase())
    );
  }, [isLead, data.quotations, row]);

  if (!def || !row) {
    return <EmptyState title="Data tidak ditemukan" text="Dokumen ini mungkin sudah diarsipkan atau tautannya salah." actionLabel="Kembali ke daftar" onAction={() => router.replace(`/${moduleKey}` as any)} />;
  }

  const status = def.statusKey ? String(row[def.statusKey] ?? "") : "";
  const approval =
    approvals.find((a) => a.module === moduleKey && String(a.refId) === String(id) && a.status === "Menunggu") ??
    ((row as any)?.approval?.status === "Menunggu" ? (row as any).approval : undefined);
  const canDecide =
    !!approval &&
    CAN_APPROVE.includes(user!.role) &&
    approval.canApprove !== false &&
    (moduleKey !== "opname" ||
      user?.role === "procurement" ||
      user?.role === "finance" ||
      user?.role === "bos" ||
      user?.role === "super_admin" ||
      user?.role === "admin");
  const isExpenseFinanceActionable = moduleKey === "expenses" && isFinanceOrBos && status !== "Ditolak" && status !== "Dibayar";

  function pick(s: string) {
    setMenu(false);
    if (s === status) return;
    if (
      moduleKey === "invoices" &&
      s === "Lunas" &&
      Number(row?.total || 0) > 0 &&
      Number(row?.terbayar || 0) < Number(row?.total || 0)
    ) {
      setInvoicePayOpen(true);
      return;
    }
    if (def?.confirmStatuses?.includes(s)) setPending(s);
    else void setStatus(moduleKey, id, s).then(() => handleRefresh());
  }

  async function run(a: ModuleAction) {
    if (a.label === "Minta survey") {
      addRow("surveys", {
        lead: row.nama,
        lokasi: row.perusahaan || "Lokasi Klien",
        jadwal: getTodayIso(),
        se: data.users?.find((u: any) => u.role === "se")?.nama || "Andi Pratama",
        status: "Terjadwal",
      });
    } else if (a.label === "Jadikan project") {
      const custName = row.perusahaan || row.customer || "Klien";
      const projName = row.nama
        ? row.nama.toLowerCase().startsWith("project")
          ? row.nama
          : `Project ${row.nama}`
        : `Project ${custName}`;
      await addRow("projects", {
        nama: projName,
        customer: custName,
        perusahaan: custName,
        customerId: row.customerId,
        quotationId: leadQuotation?.id ? Number(leadQuotation.id) : undefined,
        penawaran: leadQuotation?.nomor,
        lead: row.nama,
        leadId: row.id,
        jenis: "Customer",
        pm: data.users?.find((u: any) => u.role === "pm")?.nama || "Dimas Prasetyo",
        mulai: getTodayIso(),
        selesai: row.targetSelesai || row.closing || getTodayIso(),
        status: "Berjalan",
      });
      toast("Project baru berhasil dibuat");
      router.push("/leads");
    } else if (a.label === "Buat Sales Order (SO)") {
      const matchedQuo =
        leadQuotation ||
        (data.quotations ?? []).find(
          (quot: Row) =>
            (quot.leadId && String(quot.leadId) === String(row.id)) ||
            (quot.lead && row.nama && quot.lead.trim().toLowerCase() === row.nama.trim().toLowerCase())
        );
      const quoItems = Array.isArray(matchedQuo?.items) ? matchedQuo.items : [];
      const amount = Number(matchedQuo?.totalAfterDisc || matchedQuo?.total || row.nilai || 0);
      const custName = row.perusahaan || row.customer || matchedQuo?.customer || "-";

      const createdSo = await addRow("po-client", {
        customer: custName,
        customerId: row.customerId ? Number(row.customerId) : matchedQuo?.customerId ? Number(matchedQuo.customerId) : undefined,
        penawaran: matchedQuo?.nomor ? `${matchedQuo.nomor} - ${custName}` : "-",
        quotationId: matchedQuo?.id ? Number(matchedQuo.id) : undefined,
        nilai: amount,
        tanggal: getTodayIso(),
        catatan: `[lead:${row.id}] Dibuat dari Lead: ${row.nama}${row.need ? ` — ${row.need}` : ""}`,
        items: quoItems,
        docMode: "SO",
      });

      if (createdSo?.id) {
        toast("Sales Order (SO) berhasil dibuat!");
        router.push(`/po-client/${createdSo.id}` as any);
      }
      return;
    } else if (a.label === "Buat PO supplier") {
      const firstSuppId = data.suppliers?.[0]?.id ? String(data.suppliers[0].id) : undefined;
      const targetSupplier = row.supplier || (data.suppliers?.[0]?.nama ?? "Supplier Utama");
      const targetSupplierId = row.supplierId || firstSuppId;

      const reqItems = Array.isArray(row.items) && row.items.length
        ? row.items.map((i: any) => ({
            productId: i.productId || i.product?.id ? Number(i.productId || i.product?.id) : undefined,
            customName: i.customName || undefined,
            customUnit: i.customUnit || undefined,
            qty: Number(i.qty) || 1,
            price: Number(i.unitCost || i.estimatedPrice || i.price || (row.estimasi ? Math.round(row.estimasi / row.items.length) : 0)),
          }))
        : undefined;

      const created = await addRow("supplier-pos", {
        supplier: targetSupplier !== "-" ? targetSupplier : (data.suppliers?.[0]?.nama ?? "Supplier Utama"),
        supplierId: targetSupplierId,
        request: row.nomor,
        requestId: row.id,
        projectId: row.projectId,
        project: row.project,
        paymentTerms: row.paymentMethod === "KAS" ? "Kas / Tunai" : "Tempo / Utang",
        item: row.item,
        items: reqItems,
        total: row.estimasi || 0,
        status: "Draft",
      });
      if (created) {
        toast(`PO supplier untuk request ${row.nomor} berhasil dibuat!`);
        router.push(`/supplier-pos/${created.id}` as any);
      }
      return;
    } else if (a.label === "Buat invoice") {
      const q = moduleKey === "quotations" ? row : (data.quotations ?? []).find(
        (quot) => (quot.leadId && String(quot.leadId) === String(row.id)) || (quot.lead && quot.lead.toLowerCase() === row.nama?.toLowerCase())
      );
      const custName = row.customer || row.perusahaan || q?.customer || "Klien";
      const proj = (data.projects ?? []).find(
        (p) =>
          (q && p.quotationId && String(p.quotationId) === String(q.id)) ||
          (row.id && moduleKey === "leads" && p.leadId && String(p.leadId) === String(row.id))
      );
      let pId = proj ? String(proj.id) : undefined;
      let pName = proj ? proj.nama : undefined;
      if (!pId) {
        const createdProj = await addRow("projects", {
          nama: `Project ${q?.nomor || row.nama || custName}`,
          customer: custName,
          perusahaan: custName,
          customerId: row.customerId || q?.customerId,
          quotationId: q?.id,
          jenis: "Customer",
          pm: data.users?.find((u: any) => u.role === "pm")?.nama || "Dimas Prasetyo",
          mulai: new Date().toISOString().slice(0, 10),
          selesai: row.targetSelesai || row.closing || row.berlaku || new Date().toISOString().slice(0, 10),
          status: "Berjalan",
        });
        if (createdProj) {
          pId = String(createdProj.id);
          pName = createdProj.nama;
        }
      }
      const rawVal = q?.totalAfterDisc || q?.total || row.totalAfterDisc || row.total || row.nilai || 0;
      const nilai = typeof rawVal === "number" ? rawVal : Number(String(rawVal).replace(/\D/g, "")) || 0;
      const ppn = Math.round(nilai * 0.11);
      const total = nilai + ppn;
      const todayIso = getTodayIso();
      const [year, month] = todayIso.split("-");
      const invNumber = `INV/${year}/${month}/${String(row.id).padStart(3, "0")}`;
      const createdInv = await addRow("invoices", {
        nomor: invNumber,
        customer: custName,
        customerId: row.customerId || q?.customerId,
        project: pName,
        projectId: pId,
        quotationId: q?.id,
        jenis: "Termin",
        nilai,
        ppn,
        total,
        tanggal: todayIso,
        jatuhTempo: get30DaysLaterIso(),
        status: "Belum dikirim",
      });
      if (createdInv) {
        toast(`Invoice ${invNumber} berhasil dibuat & masuk daftar invoice!`);
        router.push(`/invoices/${createdInv.id}` as any);
      }
      return;
    } else if (moduleKey === "invoices" && a.label === "Catat pembayaran") {
      setInvoicePayOpen(true);
      return;
    } else if (moduleKey === "invoices" && a.label === "Kirim ke customer") {
      await setStatus("invoices", id, "Terkirim");
      toast("Invoice berhasil dikirim ke customer");
      handleRefresh();
      return;
    } else if (moduleKey === "delivery-notes" && (a.label.toLowerCase().includes("upload") || a.label.toLowerCase().includes("laporan") || a.label.toLowerCase().includes("surat jalan"))) {
      setDeliveryDocFileId(row.scanFileId || row.fileId || null);
      setDeliveryDocReport(row.reportText || "");
      setDeliveryDocTargetStatus(row.status === "Diterima" ? "Diterima" : "Dikirim");
      setDeliveryDocOpen(true);
      return;
    }
    if (a.status) {
      await setStatus(moduleKey, id, a.status);
      handleRefresh();
    } else if (a.toast) toast(a.toast);
    if (a.to && row) router.push(a.to(row) as any);
  }

  const canOfferLead = ["Qualification", "Proposal", "Negotiation"].includes(String(row.status));
  const filteredActions = (def.actions ?? []).filter((a) => {
    if (isLead) {
      if (a.label === "Download template penawaran" && !canOfferLead) return false;
      if (a.label === "Jadikan project" && row.status === "Lost") return false;
      if (a.label === "Buat Sales Order (SO)" && row.status === "Lost") return false;
    }
    if (moduleKey === "invoices") {
      const rawStatusUpper = String(row.rawStatus || "").toUpperCase();
      const isSent = row.status !== "Belum dikirim" && row.status !== "Draft" && rawStatusUpper !== "DRAFT";
      if (a.label === "Catat pembayaran") {
        const isPaid = row.status === "Lunas" || rawStatusUpper === "PAID" || (row.total > 0 && row.terbayar >= row.total);
        if (!isSent || isPaid || row.status === "Batal" || row.status === "Dibatalkan") return false;
      }
      if (a.label === "Kirim ke customer") {
        if (isSent || row.status === "Batal" || row.status === "Dibatalkan") return false;
      }
    }
    if (moduleKey === "quotations" && a.label === "Kirim ke customer") {
      const st = String(row.status ?? "");
      if (["Terkirim", "Disetujui", "Ditolak", "Kedaluwarsa", "Not Yet"].includes(st)) return false;
    }
    if (moduleKey === "quotations" && a.label === "Buat invoice") {
      const isFinanceOrAdmin = ["finance", "admin", "super_admin", "bos"].includes(
        (user?.role || "").toLowerCase()
      );
      if (!isFinanceOrAdmin) return false;
      const qHasInvoice = (data.invoices ?? []).some(
        (inv: Row) =>
          (inv.quotationId && String(inv.quotationId) === String(row.id)) ||
          (inv.nomorPenawaran && inv.nomorPenawaran === row.nomor)
      );
      if (qHasInvoice || row.status === "Ditolak" || row.status === "Kedaluwarsa") return false;
    }
    if (moduleKey === "purchase-requests") {
      if (a.label === "Buat PO supplier") return false;
      if (a.label === "Teruskan ke Gudang") {
        if (user?.role === "gudang") return false;
        const st = String(row?.rawStatus || (row?.status ? toEnum("purchase-requests", row.status) : "") || "").toUpperCase();
        if (st && st !== "DIAJUKAN") return false;
      }
    }
    if (moduleKey === "surveys" && a.label === "Laporkan biaya survey") {
      const st = String(row.status ?? "");
      const biaya = Number(row.biaya || 0);
      if (st === "Selesai" || st === "Dibatalkan" || biaya > 0) return false;
    }
    if (moduleKey === "delivery-notes") {
      const st = String(row.status ?? "");
      if (st === "Dibatalkan") return false;
    }
    return true;
  });

  const [primary, ...secondary] = filteredActions;
  const isLost = pending === "Lost";

  function handlePrimaryAction(a: ModuleAction) {
    if (isLead && a.label === "Download template penawaran") {
      downloadQuotationTemplate({
        leadId: row?.id,
        customer: row?.perusahaan,
        lead: row?.nama,
        signer: row?.pemilik,
      });
      toast(a.toast || "Template Excel penawaran (.xlsx) berhasil diunduh");
      return;
    }
    run(a);
  }

  async function handleSaveDeliveryDoc() {
    if (!deliveryDocFileId && !deliveryDocReport.trim()) {
      toast("Lampirkan file surat jalan / bukti pengiriman atau isi laporan terlebih dahulu", "danger");
      return;
    }
    setSubmittingDeliveryDoc(true);
    try {
      const patchPayload: Record<string, any> = {};
      if (deliveryDocFileId) {
        patchPayload.scanFileId = deliveryDocFileId;
        patchPayload.fileId = deliveryDocFileId;
      }
      if (deliveryDocReport.trim()) {
        patchPayload.reportText = deliveryDocReport.trim();
      }
      if (Object.keys(patchPayload).length > 0) {
        await patchRow("delivery-notes", id, patchPayload).catch(() => {});
      }

      const hasGoods = row.withGoods !== undefined ? Boolean(row.withGoods) : (row.barang && row.barang !== "-");
      if (hasGoods) {
        const itemsPayload = (Array.isArray(row.items) ? row.items : [])
          .map((i: any) => ({
            productId: Number(i.productId ?? i.product?.id),
            qty: Number(i.qty) || 1,
            serials: Array.isArray(i.serials) ? i.serials.join(", ") : i.serials ? String(i.serials) : undefined,
            note: i.note ? String(i.note) : undefined,
          }))
          .filter((i: any) => !Number.isNaN(i.productId) && i.productId > 0);

        const serialsPayload = Array.isArray(row.snList) ? row.snList : [];

        await api("POST", `/delivery-notes/${id}/goods`, {
          items: itemsPayload,
          serials: serialsPayload,
        }).catch((e: any) => {
          console.warn("Goods dispatch note:", e?.message);
        });
      }

      const targetStatus = deliveryDocTargetStatus === "Diterima" ? "Diterima" : "Dikirim";
      await setStatus("delivery-notes", id, targetStatus);

      if (deliveryDocFileId) {
        const matchedSo = (data["po-client"] ?? []).find(
          (so: Row) =>
            (row.soId && String(so.id) === String(row.soId)) ||
            (row.clientPoId && String(so.id) === String(row.clientPoId)) ||
            (so.id && String(row.alasan || "").includes(`[so:${so.id}]`)) ||
            (so.nomorSo && so.nomorSo !== "-" && String(row.alasan || "").includes(so.nomorSo))
        );
        if (matchedSo?.id) {
          await patchRow("po-client", matchedSo.id, { doFileId: deliveryDocFileId }).catch(() => {});
        }
      }

      const path = PATHS[moduleKey];
      if (path) {
        const fresh = await api<any>("GET", `${path}/${id}`).catch(() => null);
        if (fresh) setRemoteRow(adaptRow(moduleKey, fresh));
      }
      handleRefresh();

      toast(`Dokumen surat jalan disimpan, barang ditandai ${targetStatus} & stok inventory berkurang!`);
      setDeliveryDocOpen(false);
    } catch (err: any) {
      toast(err?.message || "Gagal memproses dokumen surat jalan", "danger");
    } finally {
      setSubmittingDeliveryDoc(false);
    }
  }

  return (
    <>
      <PageHeader
        back
        title={def.titleOf(row)}
        subtitle={def.subtitleOf?.(row)}
        status={status || undefined}
        action={
          <>
            {canDelete ? (
              <Button variant="outline" onPress={() => setDeleteOpen(true)}>
                <Trash2 size={15} color={colors.danger} />
                <Text className="text-danger">Hapus</Text>
              </Button>
            ) : null}
            {moduleKey === "delivery-notes" && (status === "Pending" || !status || status === "Menunggu persetujuan") ? (
              <Button
                variant="outline"
                className="border-primary/50"
                onPress={() => router.push(`/delivery-notes/new?id=${id}` as any)}
              >
                <Text className="text-primary font-medium">Edit Surat Jalan & Barang</Text>
              </Button>
            ) : null}
            {def.statuses.length > 1 && !(isLead && (user?.role === "bos" || user?.role === "admin")) ? (
              <Button variant="outline" onPress={() => setMenu(true)}>
                <Text>Ubah status</Text>
                <ChevronDown size={16} color={colors.text} />
              </Button>
            ) : null}
            {secondary.map((a) => (
              <Button key={a.label} variant="outline" onPress={() => handlePrimaryAction(a)}><Text>{a.label}</Text></Button>
            ))}
            {primary ? <Button onPress={() => handlePrimaryAction(primary)}><Text>{primary.label}</Text></Button> : null}
          </>
        }
      />

      <View className={cn("gap-4", isDirty && "pb-24")}>
        {isExpenseFinanceActionable ? (
          <View className="bg-card border-border rounded-xl border p-4 gap-3">
            <View className="flex-row items-center justify-between flex-wrap gap-3">
              <View className="gap-1 flex-1 min-w-[200px]">
                <Text className="text-sm font-semibold text-foreground">
                  Persetujuan & Reimbursement Finance
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {status === "Disetujui"
                    ? "Pengeluaran sudah disetujui. Silakan selesaikan pembayaran dan lampirkan bukti transfer reimbursement."
                    : "Periksa bukti nota pengeluaran dan tentukan persetujuan atau pembayaran reimbursement."}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Button variant="outline" onPress={() => setRejectExpenseOpen(true)}>
                  <Text className="text-danger font-medium">Tolak</Text>
                </Button>
                <Button
                  onPress={() => {
                    setExpenseFundSource(
                      row?.paymentMethod && /bank/i.test(String(row.paymentMethod)) ? "Bank" : "Kas Kecil"
                    );
                    setApproveExpenseOpen(true);
                  }}
                >
                  <Check size={15} color={colors.background} className="mr-1.5" />
                  <Text>Setujui & Bayar</Text>
                </Button>
              </View>
            </View>
          </View>
        ) : canDecide ? (
          <ApprovalBar
            amount={approval!.nilai}
            amountLabel={
              moduleKey === "opname"
                ? `${approval!.nilai} SKU selisih`
                : moduleKey === "surveys"
                ? "Persetujuan Permintaan Survey"
                : moduleKey === "delivery-notes"
                ? "Persetujuan Surat Jalan"
                : undefined
            }
            financeOk={(approval as any).financeOk}
            onApprove={async () => {
              await decide(approval!.id, "Disetujui");
              await handleRefresh();
            }}
            onReject={async (r) => {
              await decide(approval!.id, "Ditolak", r);
              await handleRefresh();
            }}
          />
        ) : null}

        {!canEdit ? (
          <Panel
            title="Informasi"
            subtitle={
              moduleKey === "expenses"
                ? row?.status === "Dibayar"
                  ? "Pengeluaran sudah dibayar dan tidak dapat diubah"
                  : "Data pengeluaran hanya dapat diubah oleh pelapor atau Finance"
                : undefined
            }
          >
            <InfoGrid
              fields={
                moduleKey === "suppliers"
                  ? def.fields.filter((f) => f.key !== "tagSummary" && f.key !== "tagInput" && f.key !== "tags")
                  : def.fields
              }
              row={row}
            />
          </Panel>
        ) : editableFields.length > 0 || readOnlyFields.length > 0 ? (
          <Panel title="Informasi">
            {readOnlyFields.length > 0 ? (
              <View className="mb-4 p-3 bg-panel/40 rounded-xl border border-border/70 flex-row flex-wrap gap-y-3">
                {readOnlyFields.map((f) => (
                  <View key={f.key} className="gap-0.5 pr-4 min-w-[130px] flex-1">
                    <Text className="text-muted-foreground text-[11px] uppercase tracking-wider font-semibold">
                      {f.label}
                    </Text>
                    <Cell fmt={f.fmt} value={row[f.key]} />
                  </View>
                ))}
              </View>
            ) : null}

            <View className="flex-row flex-wrap -mx-2">
              {editableFields.map((f) => {
                const isFullWidth = f.type === "textarea" || f.type === "multiselect";
                return (
                  <React.Fragment key={f.key}>
                    <View
                      className={cn("px-2 py-2", isFullWidth ? "w-full" : "w-full sm:w-1/2")}
                    >
                      <FormField
                        label={
                          moduleKey === "quotations" && f.key === "disc" ? (
                            <View className="flex-row items-center justify-between w-full">
                              <Text className="text-sm font-medium">Diskon</Text>
                              <View className="flex-row rounded-lg bg-panel p-0.5 border border-border">
                                <Button
                                  size="sm"
                                  variant={quotationDiscType === "nominal" ? "default" : "ghost"}
                                  className="h-6 px-2.5 py-0"
                                  onPress={() => setQuotationDiscType("nominal")}
                                >
                                  <Text
                                    className={`text-xs ${
                                      quotationDiscType === "nominal"
                                        ? "text-primary-foreground font-semibold"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    Nominal (Rp)
                                  </Text>
                                </Button>
                                <Button
                                  size="sm"
                                  variant={quotationDiscType === "percent" ? "default" : "ghost"}
                                  className="h-6 px-2.5 py-0"
                                  onPress={() => {
                                    const tot = quotationFinancials.totNum;
                                    const curDisc = quotationFinancials.discNum;
                                    if (tot > 0 && curDisc > 0) {
                                      setQuotationDiscPercent(String(Math.round((curDisc / tot) * 100)));
                                    } else {
                                      setQuotationDiscPercent("");
                                    }
                                    setQuotationDiscType("percent");
                                  }}
                                >
                                  <Text
                                    className={`text-xs ${
                                      quotationDiscType === "percent"
                                        ? "text-primary-foreground font-semibold"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    Persen (%)
                                  </Text>
                                </Button>
                              </View>
                            </View>
                          ) : (
                            f.label
                          )
                        }
                        required={f.required}
                        error={errs[f.key]}
                      >
                        {f.type === "select" ? (
                          (f.key === "customer" || f.key === "customerId" || f.key === "perusahaan" || String(f.label || "").toLowerCase() === "customer") ? (
                            <CustomerSelect
                              value={getFieldValue(f)}
                              customerId={edits.customerId ?? row.customerId}
                              allowClear={!f.required}
                              placeholder={`Pilih ${f.label.toLowerCase()}...`}
                              error={!!errs[f.key]}
                              onAddNew={() => setQuickCustomerKey(f.key)}
                              addNewLabel="+ Tambah Customer Baru"
                              onChange={(cust) => {
                                if (!cust) {
                                  setFieldValue(f.key, f.required ? "" : "-");
                                  setFieldValue("customerId", null);
                                  return;
                                }
                                const name = cust.company || cust.nama || cust.name || "";
                                setFieldValue(f.key, name);
                                setFieldValue("customerId", cust.id);
                                if (cust.pic && cust.pic !== "-") {
                                  setFieldValue("kontak", cust.pic);
                                }
                              }}
                            />
                          ) : (f.key === "supplier" || f.key === "supplierId" || String(f.label || "").toLowerCase() === "supplier") ? (
                            <SupplierSelect
                              value={getFieldValue(f)}
                              supplierId={edits.supplierId ?? row.supplierId}
                              allowClear={!f.required}
                              placeholder={`Pilih ${f.label.toLowerCase()}...`}
                              error={!!errs[f.key]}
                              onAddNew={() => setQuickSupplierKey(f.key)}
                              addNewLabel="+ Tambah Supplier Baru"
                              onChange={(name, supp) => {
                                setFieldValue(f.key, name || (f.required ? "" : "-"));
                                if (supp?.id) setFieldValue("supplierId", supp.id);
                                if (supp?.payment) setFieldValue("payment", supp.payment);
                              }}
                            />
                          ) : (f.key === "lead" || f.key === "leadId") ? (
                            <LeadSelect
                              value={getFieldValue(f)}
                              leadId={edits.leadId ?? row.leadId}
                              allowClear={!f.required}
                              placeholder={`Pilih ${f.label.toLowerCase()}...`}
                              error={!!errs[f.key]}
                              onChange={(lead) => {
                                if (!lead) {
                                  setFieldValue(f.key, f.required ? "" : "-");
                                  setFieldValue("leadId", null);
                                  return;
                                }
                                const name = lead.nama || lead.name || "";
                                const comp = lead.perusahaan || lead.customer || "";
                                const lbl = comp ? `${name} · ${comp}` : name;
                                setFieldValue(f.key, lbl);
                                setFieldValue("leadId", lead.id);
                                if (lead.customer && (!edits.customer && !row.customer)) {
                                  setFieldValue("customer", lead.customer);
                                }
                              }}
                            />
                          ) : (f.key === "project" || f.key === "projectId") ? (
                            <ProjectSelect
                              value={getFieldValue(f)}
                              projectId={edits.projectId ?? row.projectId}
                              allowClear={!f.required}
                              placeholder={`Pilih ${f.label.toLowerCase()}...`}
                              error={!!errs[f.key]}
                              onChange={(proj) => {
                                if (!proj) {
                                  setFieldValue(f.key, f.required ? "" : "-");
                                  setFieldValue("projectId", null);
                                  return;
                                }
                                setFieldValue(f.key, proj.nama || proj.name || "");
                                setFieldValue("projectId", proj.id);
                                if (proj.customer && (!edits.customer && !row.customer)) {
                                  setFieldValue("customer", proj.customer);
                                }
                              }}
                            />
                          ) : (f.key === "penawaran" || f.key === "quotation" || f.key === "quotationId") ? (
                            <QuotationSelect
                              value={getFieldValue(f)}
                              quotationId={edits.quotationId ?? row.quotationId}
                              allowClear={!f.required}
                              placeholder={`Pilih ${f.label.toLowerCase()}...`}
                              error={!!errs[f.key]}
                              onChange={(quote) => {
                                if (!quote) {
                                  setFieldValue(f.key, f.required ? "" : "-");
                                  setFieldValue("quotationId", null);
                                  return;
                                }
                                const lbl = `${quote.nomor || quote.number} - ${quote.customer || "-"} - ${quote.lead || quote.nama || "-"}`;
                                setFieldValue(f.key, lbl);
                                setFieldValue("quotationId", quote.id);
                                if (quote.customer && (!edits.customer && !row.customer)) {
                                  setFieldValue("customer", quote.customer);
                                }
                              }}
                            />
                          ) : (f.key === "po" || f.key === "clientPo" || f.key === "clientPoId") ? (
                            <PoClientSelect
                              value={getFieldValue(f)}
                              poId={edits.clientPoId ?? row.clientPoId}
                              placeholder={`Pilih ${f.label.toLowerCase()}...`}
                              error={!!errs[f.key]}
                              onChange={(po) => {
                                if (!po) {
                                  setFieldValue(f.key, f.required ? "" : "-");
                                  setFieldValue("clientPoId", null);
                                  return;
                                }
                                const lbl = po.nomor || po.number || po.nomorPoClient || "";
                                setFieldValue(f.key, lbl);
                                setFieldValue("clientPoId", po.id);
                                if (po.customer && (!edits.customer && !row.customer)) {
                                  setFieldValue("customer", po.customer);
                                }
                              }}
                            />
                          ) : (f.key === "survey" || f.key === "surveyId") ? (
                            <SurveySelect
                              value={getFieldValue(f)}
                              surveyId={edits.surveyId ?? row.surveyId}
                              allowClear={!f.required}
                              placeholder={`Pilih ${f.label.toLowerCase()}...`}
                              error={!!errs[f.key]}
                              onChange={(survey) => {
                                if (!survey) {
                                  setFieldValue(f.key, f.required ? "" : "-");
                                  setFieldValue("surveyId", null);
                                  return;
                                }
                                const lbl = `Survey #${survey.id} - ${survey.lead || survey.customer || survey.lokasi || "Survey"}`;
                                setFieldValue(f.key, lbl);
                                setFieldValue("surveyId", survey.id);
                              }}
                            />
                          ) : (f.key === "pocReport" || f.key === "poc" || f.key === "pocId" || f.key === "pocReportId") ? (
                            <PocSelect
                              value={getFieldValue(f)}
                              pocId={edits.pocReportId ?? edits.pocId ?? row.pocReportId ?? row.pocId}
                              allowClear={!f.required}
                              placeholder={`Pilih ${f.label.toLowerCase()}...`}
                              error={!!errs[f.key]}
                              onChange={(poc) => {
                                if (!poc) {
                                  setFieldValue(f.key, f.required ? "" : "-");
                                  setFieldValue("pocReportId", null);
                                  return;
                                }
                                const lbl = `POC ${poc.nomor || poc.number} - ${poc.judul || poc.title}`;
                                setFieldValue(f.key, lbl);
                                setFieldValue("pocReportId", poc.id);
                              }}
                            />
                          ) : (f.key === "visitReport" || f.key === "visit" || f.key === "visitId" || f.key === "visitReportId") ? (
                            <VisitSelect
                              value={getFieldValue(f)}
                              visitId={edits.visitReportId ?? edits.visitId ?? row.visitReportId ?? row.visitId}
                              allowClear={!f.required}
                              placeholder={`Pilih ${f.label.toLowerCase()}...`}
                              error={!!errs[f.key]}
                              onChange={(visit) => {
                                if (!visit) {
                                  setFieldValue(f.key, f.required ? "" : "-");
                                  setFieldValue("visitReportId", null);
                                  return;
                                }
                                const lbl = `VISIT ${visit.nomor || visit.number} - ${visit.judul || visit.title}`;
                                setFieldValue(f.key, lbl);
                                setFieldValue("visitReportId", visit.id);
                              }}
                            />
                          ) : (
                            <SearchableSelect
                              value={getFieldValue(f)}
                              onAddNew={
                                (f.key === "customer" || f.key === "perusahaan" || f.key === "customerId" || String(f.label || "").toLowerCase().includes("customer"))
                                  ? () => setQuickCustomerKey(f.key)
                                  : (f.key === "supplier" || f.key === "supplierId" || String(f.label || "").toLowerCase().includes("supplier") || String(f.label || "").toLowerCase().includes("vendor"))
                                  ? () => setQuickSupplierKey(f.key)
                                  : undefined
                              }
                              addNewLabel={
                                (f.key === "supplier" || f.key === "supplierId" || String(f.label || "").toLowerCase().includes("supplier") || String(f.label || "").toLowerCase().includes("vendor"))
                                  ? "+ Tambah Supplier Baru"
                                  : "+ Tambah Customer Baru"
                              }
                              onChange={(v) => setFieldValue(f.key, v)}
                              options={getDynamicOptions(f, data, def.key, fallbackUsers) ?? []}
                              placeholder={`Pilih ${f.label.toLowerCase()}`}
                              error={!!errs[f.key]}
                            />
                          )
                        ) : f.type === "multiselect" ? (
                          <MultiSelect
                            values={(() => {
                              const val = getFieldValue(f);
                              return Array.isArray(val)
                                ? val
                                : val
                                ? String(val).split(",").map((s) => s.trim()).filter(Boolean)
                                : [];
                            })()}
                            onChange={(vals) => setFieldValue(f.key, vals)}
                            options={getDynamicOptions(f, data, def.key, fallbackUsers) ?? []}
                            placeholder={`Pilih ${f.label.toLowerCase()}`}
                            error={!!errs[f.key]}
                          />
                        ) : f.type === "date" ? (
                          <DatePicker
                            value={getFieldValue(f)}
                            onChange={(v) => setFieldValue(f.key, v)}
                            placeholder="Pilih tanggal"
                            error={!!errs[f.key]}
                          />
                        ) : f.type === "number" ? (
                          moduleKey === "quotations" && f.key === "disc" ? (
                            quotationDiscType === "percent" ? (
                              <View className="gap-1">
                                <Input
                                  value={quotationDiscPercent}
                                  onChangeText={(val) => {
                                    const pctStr = String(val ?? "").replace(/\D/g, "");
                                    setQuotationDiscPercent(pctStr);
                                    const pct = Number(pctStr) || 0;
                                    const tot = quotationFinancials.totNum;
                                    const calculatedNominal = Math.round(tot * (pct / 100));
                                    setFieldValue("disc", formatThousands(calculatedNominal));
                                  }}
                                  keyboardType="numeric"
                                  placeholder="Contoh: 10"
                                  className={cn(errs[f.key] && "border-danger")}
                                />
                                <Text className="text-[11px] text-muted-foreground">
                                  Nilai diskon: {rupiah(quotationFinancials.discNum)}
                                </Text>
                              </View>
                            ) : (
                              <View className="gap-1">
                                <Input
                                  value={getFieldValue(f)}
                                  onChangeText={(v) => setFieldValue(f.key, formatThousands(v))}
                                  keyboardType="numeric"
                                  placeholder="Contoh: 500.000"
                                  className={cn(errs[f.key] && "border-danger")}
                                />
                                {quotationFinancials.totNum > 0 && quotationFinancials.discNum > 0 ? (
                                  <Text className="text-[11px] text-muted-foreground">
                                    Setara dengan {Math.round((quotationFinancials.discNum / quotationFinancials.totNum) * 100)}%
                                  </Text>
                                ) : null}
                              </View>
                            )
                          ) : (
                            <Input
                              value={getFieldValue(f)}
                              onChangeText={(v) => setFieldValue(f.key, formatThousands(v))}
                              keyboardType="numeric"
                              placeholder={`Masukkan ${f.label.toLowerCase()}`}
                              className={cn(errs[f.key] && "border-danger")}
                            />
                          )
                        ) : f.type === "textarea" ? (
                          <Textarea
                            value={getFieldValue(f)}
                            onChangeText={(v) => setFieldValue(f.key, v)}
                            placeholder={`Tulis ${f.label.toLowerCase()}`}
                            className={cn(errs[f.key] && "border-danger")}
                          />
                        ) : moduleKey === "delivery-notes" && f.key === "barang" ? (
                          <View className="gap-2 p-3 bg-panel/60 rounded-xl border border-border">
                            <View className="flex-row items-center justify-between">
                              <Text className="text-xs text-muted-foreground font-medium">
                                Barang Fisik & Serial Number
                              </Text>
                              {(status === "Pending" || !status || status === "Menunggu persetujuan") ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2.5 border-primary/60"
                                  onPress={() => router.push(`/delivery-notes/new?id=${id}` as any)}
                                >
                                  <Text className="text-xs text-primary font-semibold">Buka Form Edit Barang</Text>
                                </Button>
                              ) : null}
                            </View>
                            <Text className="text-sm font-medium text-foreground">
                              {row.barang && row.barang !== "-" ? row.barang : "Tanpa barang"}
                            </Text>
                            {Array.isArray(row.items) && row.items.length > 0 ? (
                              <Text className="text-xs text-muted-foreground">
                                Terdaftar {row.items.length} item barang di surat jalan ini.
                              </Text>
                            ) : null}
                          </View>
                        ) : (
                          <Input
                            value={getFieldValue(f)}
                            onChangeText={(v) => setFieldValue(f.key, v)}
                            placeholder={`Masukkan ${f.label.toLowerCase()}`}
                            className={cn(errs[f.key] && "border-danger")}
                          />
                        )}
                      </FormField>
                    </View>

                    {moduleKey === "quotations" &&
                    (f.key === "disc" || (!editableFields.some((ef) => ef.key === "disc") && f.key === "nilai")) ? (
                      <QuotationPpnField
                        mode={quotationPpnMode}
                        onChange={setQuotationPpnMode}
                        ppn={quotationFinancials.ppn}
                        totalAfterDisc={quotationFinancials.totalAfterDisc}
                        dpp={quotationFinancials.dpp}
                      />
                    ) : null}

                    {moduleKey === "invoices" && f.key === "nilai" ? (
                      <>
                        <QuotationPpnField
                          mode={quotationPpnMode}
                          onChange={setQuotationPpnMode}
                          ppn={invoiceFinancials.ppn}
                          totalAfterDisc={invoiceFinancials.total}
                          dpp={invoiceFinancials.dpp}
                        />
                        <QuotationPphField
                          mode={quotationPphMode}
                          onChange={setQuotationPphMode}
                          pph={invoiceFinancials.pph}
                        />
                      </>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </View>
          </Panel>
        ) : null}

        <ModuleExtras
          moduleKey={moduleKey}
          row={row}
          onRefresh={handleRefresh}
          invoicePayOpen={invoicePayOpen}
          onInvoicePayOpenChange={setInvoicePayOpen}
        />

        {def.docs?.length ? (
          <Panel title="File & Bukti Pendukung">
            <DocumentViewerList
              moduleKey={moduleKey}
              docs={def.docs}
              row={row}
              canUpload={canEdit}
              onUploadFile={async (fieldKey, fileId, item) => {
                try {
                  const patchPayload: Record<string, any> = { [fieldKey]: fileId };
                  if (
                    fieldKey === "receiptFileId" ||
                    fieldKey === "photoFileId" ||
                    fieldKey === "scanFileId" ||
                    fieldKey === "evidenceFileId" ||
                    fieldKey === "documentFileId" ||
                    fieldKey === "latestFileId" ||
                    fieldKey === "doFileId" ||
                    fieldKey === "prdFileId" ||
                    fieldKey === "bahpFileId" ||
                    fieldKey === "bastFileId"
                  ) {
                    patchPayload.fileId = fileId;
                  }

                  if (moduleKey === "expenses" && fieldKey === "paidFileId") {
                    await setStatus("expenses", id, "Dibayar", undefined, { paidFileId: fileId });
                    toast("Bukti transfer reimbursement berhasil dilampirkan & status diubah menjadi Dibayar");
                  } else {
                    await patchRow(moduleKey, id, patchPayload);
                    if (
                      moduleKey === "receiving" &&
                      (fieldKey === "receiptFileId" || fieldKey === "photoFileId") &&
                      row?.supplierPoId
                    ) {
                      await patchRow("supplier-pos", String(row.supplierPoId), {
                        doFileId: fileId,
                      }).catch(() => {});
                    }
                    toast(`${item.label} berhasil diperbarui`);
                  }

                  const path = PATHS[moduleKey];
                  if (path) {
                    const fresh = await api<any>("GET", `${path}/${id}`).catch(() => null);
                    if (fresh) setRemoteRow(adaptRow(moduleKey, fresh));
                  }
                } catch (err: any) {
                  toast(err?.message || "Gagal memperbarui file", "danger");
                }
              }}
            />
          </Panel>
        ) : null}

        <Panel title="Riwayat"><Timeline items={history(moduleKey, id)} /></Panel>
      </View>

      {isDirty ? (
        <Portal name="module-detail-save-bar">
          <View
            style={floatingStyle as any}
            className="bg-card border-t border-border px-6 py-3.5 flex-row items-center justify-between gap-4"
          >
            <View className="flex-1 pr-2">
              <Text className="text-sm font-semibold text-foreground">Perubahan belum disimpan</Text>
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                Simpan perubahan atau batalkan untuk kembali.
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Button
                variant="outline"
                onPress={handleReset}
                disabled={saving}
                className="h-10 px-4 rounded-xl"
              >
                <Text className="font-medium text-sm">Batal</Text>
              </Button>
              <Button
                onPress={handleSaveForm}
                disabled={saving}
                className="h-10 px-5 rounded-xl bg-primary"
              >
                <Check size={16} color={colors.background} className="mr-1.5" />
                <Text className="font-semibold text-sm text-primary-foreground">
                  {saving ? "Menyimpan..." : "Simpan Perubahan"}
                </Text>
              </Button>
            </View>
          </View>
        </Portal>
      ) : null}

      <Dialog open={menu} onOpenChange={setMenu}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Ubah status</DialogTitle></DialogHeader>
          <Text className="text-muted-foreground text-sm">Status boleh dipilih bebas. Setiap perubahan tercatat di riwayat.</Text>
          {def.statuses.map((s) => (
            <Pressable key={s} onPress={() => pick(s)} className={cn("hover:bg-panel active:bg-panel min-h-[44px] justify-center rounded-lg px-2", s === status && "bg-primary/15")}>
              <StatusBadge status={s} />
            </Pressable>
          ))}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Hapus ${def.singular} ini?`}
        description="Data yang dihapus tidak dapat dikembalikan."
        confirmLabel="Ya, hapus"
        destructive
        onConfirm={() => {
          void deleteRow(moduleKey, id).then((ok) => {
            if (ok) router.replace(`/${moduleKey}` as any);
          });
        }}
      />

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(v) => !v && setPending(null)}
        title={isLost ? "Tandai lead ini Lost?" : `Ubah status ke ${pending}?`}
        description={
          isLost
            ? "Lead pindah ke kolom Lost dan tidak muncul di pipeline aktif. Data tetap tersimpan dan bisa dibuka lagi."
            : "Pihak terkait akan diberi tahu. Perubahan ini tercatat di audit log."
        }
        confirmLabel="Ya, ubah"
        destructive
        reasonLabel={isLost ? "Alasan Lost" : undefined}
        reasonOptions={isLost ? lostReasons : undefined}
        onConfirm={(r) => pending && setStatus(moduleKey, id, pending, r)}
      />

      <Dialog
        open={approveExpenseOpen}
        onOpenChange={(open) => {
          if (open) {
            setExpenseFundSource(
              row?.paymentMethod && /bank/i.test(String(row.paymentMethod)) ? "Bank" : "Kas Kecil"
            );
          }
          setApproveExpenseOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Setujui & Bayar Reimbursement</DialogTitle>
            <DialogDescription>
              Klaim pengeluaran sebesar <Text className="font-semibold text-primary">{rupiah(row.nominal || 0)}</Text> untuk pelapor <Text className="font-semibold text-foreground">{row.pelapor || "-"}</Text>.
            </DialogDescription>
          </DialogHeader>

          <View className="gap-3 py-2">
            <FormField label="Sumber Dana (Kas Kecil / Bank)" required>
              <SearchableSelect
                value={expenseFundSource}
                options={["Kas Kecil", "Bank"]}
                onChange={setExpenseFundSource}
                placeholder="Pilih sumber dana..."
              />
            </FormField>

            <FormField label="Bukti Transfer Reimbursement (Opsional)">
              <FileUploader
                label="Upload Bukti Transfer Bank / E-Wallet (JPG, PNG, PDF)"
                kind="semua"
                category="foto-struk"
                handleRef={(h) => { expenseFileHandle.current = h; }}
              />
            </FormField>

            <FormField label="Catatan / Nomor Referensi Transfer (Opsional)">
              <Input
                value={expenseTransferNote}
                onChangeText={setExpenseTransferNote}
                placeholder="Contoh: TRF-BCA-981290 / Transfer via BCA"
              />
            </FormField>
          </View>

          <DialogFooter>
            <Button variant="outline" onPress={() => setApproveExpenseOpen(false)} disabled={submittingExpense}>
              <Text>Batal</Text>
            </Button>
            <Button
              onPress={async () => {
                setSubmittingExpense(true);
                try {
                  const paidFileId = (await expenseFileHandle.current?.flush()) ?? undefined;
                  const targetStatus = paidFileId ? "Dibayar" : "Disetujui";
                  await setStatus("expenses", id, targetStatus, expenseTransferNote.trim() || undefined, {
                    paidFileId,
                    paymentMethod: expenseFundSource,
                  });
                  const path = PATHS[moduleKey];
                  if (path) {
                    const fresh = await api<any>("GET", `${path}/${id}`).catch(() => null);
                    if (fresh) setRemoteRow(adaptRow(moduleKey, fresh));
                  }
                  toast(paidFileId ? "Reimbursement berhasil dibayar & bukti transfer dilampirkan" : "Pengeluaran disetujui");
                  setApproveExpenseOpen(false);
                  setExpenseTransferNote("");
                } catch (e: any) {
                  toast(e?.message || "Gagal menyetujui pengeluaran", "danger");
                } finally {
                  setSubmittingExpense(false);
                }
              }}
              disabled={submittingExpense}
            >
              <Check size={16} color={colors.background} className="mr-1.5" />
              <Text>{submittingExpense ? "Menyimpan..." : "Setujui & Selesaikan"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={rejectExpenseOpen}
        onOpenChange={setRejectExpenseOpen}
        title="Tolak Pengeluaran ini?"
        description="Pengeluaran akan ditolak. Berikan alasan penolakan agar pelapor mengetahui perbaikan yang diperlukan."
        confirmLabel="Tolak Pengeluaran"
        destructive
        reasonLabel="Alasan penolakan (Wajib diisi)"
        onConfirm={async (reason) => {
          if (!reason?.trim()) {
            toast("Alasan penolakan wajib diisi", "danger");
            return;
          }
          await setStatus("expenses", id, "Ditolak", reason.trim());
          const path = PATHS[moduleKey];
          if (path) {
            const fresh = await api<any>("GET", `${path}/${id}`).catch(() => null);
            if (fresh) setRemoteRow(adaptRow(moduleKey, fresh));
          }
          toast("Pengeluaran ditolak", "danger");
          setRejectExpenseOpen(false);
        }}
      />

      <Dialog open={deliveryDocOpen} onOpenChange={setDeliveryDocOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Surat Jalan & Dokumen Pengiriman</DialogTitle>
            <DialogDescription>
              Unggah file fisik surat jalan / DO bertanda tangan atau dokumentasi serah terima. Menyimpan ini akan memotong stok barang dari inventory dan memperbarui status pengiriman.
            </DialogDescription>
          </DialogHeader>

          <View className="gap-3 py-2">
            <FileUploader
              label="File Surat Jalan / DO Bertanda Tangan (Gambar / PDF)"
              kind="semua"
              accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
              allowedExtensions={["jpg", "jpeg", "png", "webp", "pdf"]}
              category="surat-jalan"
              autoFlush
              onUploaded={(fid) => setDeliveryDocFileId(fid)}
            />

            <View className="gap-1">
              <Text className="text-xs text-muted-foreground font-medium">Laporan Hasil / Catatan Pengiriman</Text>
              <Textarea
                value={deliveryDocReport}
                onChangeText={setDeliveryDocReport}
                placeholder="Contoh: Barang telah diserahkan ke klien/security dalam kondisi baik..."
                numberOfLines={3}
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-xs text-muted-foreground font-medium">Ubah Status Surat Jalan Menjadi</Text>
              <View className="flex-row gap-2">
                <Button
                  variant={deliveryDocTargetStatus === "Dikirim" ? "default" : "outline"}
                  size="sm"
                  onPress={() => setDeliveryDocTargetStatus("Dikirim")}
                  className="flex-1 h-8"
                >
                  <Text className="text-xs">Dikirim (Barang Keluar)</Text>
                </Button>
                <Button
                  variant={deliveryDocTargetStatus === "Diterima" ? "default" : "outline"}
                  size="sm"
                  onPress={() => setDeliveryDocTargetStatus("Diterima")}
                  className="flex-1 h-8"
                >
                  <Text className="text-xs">Diterima (Selesai)</Text>
                </Button>
              </View>
            </View>
          </View>

          <DialogFooter className="gap-2">
            <Button variant="outline" onPress={() => setDeliveryDocOpen(false)} disabled={submittingDeliveryDoc}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveDeliveryDoc} disabled={submittingDeliveryDoc}>
              <Text>{submittingDeliveryDoc ? "Menyimpan & Potong Stok..." : "Simpan & Proses Pengiriman"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickAddCustomerDialog
        open={!!quickCustomerKey}
        onOpenChange={(op) => { if (!op) setQuickCustomerKey(null); }}
        onSuccess={(newCust) => {
          if (quickCustomerKey) {
            setFieldValue(quickCustomerKey, newCust.nama);
            setQuickCustomerKey(null);
          }
        }}
      />
      <QuickAddSupplierDialog
        open={!!quickSupplierKey}
        onOpenChange={(op) => { if (!op) setQuickSupplierKey(null); }}
        onSuccess={(newSupp) => {
          if (quickSupplierKey) {
            setFieldValue(quickSupplierKey, newSupp.nama);
            setQuickSupplierKey(null);
          }
        }}
      />
    </>
  );
}
