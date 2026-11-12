import * as React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  BookOpen,
  Plus,
  Scale,
  TrendingUp,
  FileText,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { PageHeader } from "@/components/taska/basics";
import { ConfirmDialog } from "@/components/taska/dialogs";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { colors } from "@/tokens";
import {
  CHART_OF_ACCOUNTS,
  type CoaAccount,
  type CoaTrialBalanceRow,
  type JournalLine,
  type ManualJournal,
  type ManualJournalLine,
  buildCoaTree,
  computeFinancialStatements,
  loadCustomCoa,
  loadDeletedCoaCodes,
  loadManualJournals,
  saveCustomCoa,
  saveDeletedCoaCodes,
  saveManualJournals,
} from "@/lib/accounting";

import { AccountingTab } from "@/modules/accounting/types";
import { JournalTab } from "@/modules/accounting/components/journal-tab";
import { CoaTab } from "@/modules/accounting/components/coa-tab";
import { LedgerTab } from "@/modules/accounting/components/ledger-tab";
import { SummaryTab } from "@/modules/accounting/components/summary-tab";
import { TaxTab } from "@/modules/accounting/components/tax-tab";
import { PeriodTab } from "@/modules/accounting/components/period-tab";
import { ReturnTab } from "@/modules/accounting/components/return-tab";
import { ManualJournalDialog } from "@/modules/accounting/components/manual-journal-dialog";
import { CreateCoaDialog } from "@/modules/accounting/components/create-coa-dialog";

function formatJournalDateTime(dateVal: any, createdAtVal?: any): string {
  const dSource = createdAtVal ? new Date(createdAtVal) : dateVal ? new Date(dateVal) : null;
  if (!dSource || isNaN(dSource.getTime())) {
    return dateVal ? String(dateVal).slice(0, 10) : "-";
  }
  let yyyy = dSource.getFullYear();
  let mm = String(dSource.getMonth() + 1).padStart(2, "0");
  let dd = String(dSource.getDate()).padStart(2, "0");
  if (dateVal) {
    const dDate = new Date(dateVal);
    if (!isNaN(dDate.getTime())) {
      yyyy = dDate.getFullYear();
      mm = String(dDate.getMonth() + 1).padStart(2, "0");
      dd = String(dDate.getDate()).padStart(2, "0");
    }
  }
  const hh = String(dSource.getHours()).padStart(2, "0");
  const min = String(dSource.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export default function AccountingScreen() {
  const router = useRouter();
  const { data, user, toast, refreshModule } = useApp();
  const roleLower = (user?.role || "").toLowerCase();
  const canAccess = ["super_admin", "admin", "bos", "finance"].includes(roleLower);

  const params = useLocalSearchParams<{ tab?: AccountingTab; account?: string }>();
  const [activeTab, setActiveTab] = React.useState<AccountingTab>(params.tab || "journal");

  // Persistent Manual Journals, Custom COA & Deleted COA
  const [manualJournals, setManualJournals] = React.useState<ManualJournal[]>(
    () => loadManualJournals(),
  );
  const [customAccounts, setCustomAccounts] = React.useState<CoaAccount[]>(
    () => loadCustomCoa(),
  );
  const [deletedCoaCodes, setDeletedCoaCodes] = React.useState<string[]>(
    () => loadDeletedCoaCodes(),
  );
  const [deleteCoaTarget, setDeleteCoaTarget] = React.useState<CoaTrialBalanceRow | null>(null);
  const [deleteJournalTarget, setDeleteJournalTarget] = React.useState<{ id: string; journalNo?: string; keterangan?: string } | null>(null);

  const fin = React.useMemo(
    () => computeFinancialStatements(data, manualJournals, customAccounts, deletedCoaCodes),
    [data, manualJournals, customAccounts, deletedCoaCodes],
  );

  // Active COA Map
  const allAccountsMap = React.useMemo(() => {
    const map: Record<string, CoaAccount> = { ...CHART_OF_ACCOUNTS };
    customAccounts.forEach((acc) => {
      map[acc.code] = acc;
    });
    deletedCoaCodes.forEach((code) => {
      delete map[code];
    });
    return map;
  }, [customAccounts, deletedCoaCodes]);

  const allAccountsMapRef = React.useRef(allAccountsMap);
  React.useEffect(() => {
    allAccountsMapRef.current = allAccountsMap;
  }, [allAccountsMap]);

  // Tab 1: Journal filters & pagination
  const [journalQuery, setJournalQuery] = React.useState("");
  const [journalDate, setJournalDate] = React.useState("");
  const [journalSourceFilter, setJournalSourceFilter] = React.useState<string>("Semua");
  const [journalPage, setJournalPage] = React.useState(1);
  const [JOURNAL_PAGE_SIZE, setJournalPageSize] = React.useState(20);

  // Tab 2: COA filters & pagination
  const [coaQuery, setCoaQuery] = React.useState("");
  const [coaCategoryFilter, setCoaCategoryFilter] = React.useState<string>("Semua");
  const [coaPage, setCoaPage] = React.useState(1);
  const [COA_PAGE_SIZE, setCoaPageSize] = React.useState(50);

  // Tab 3: Ledger account selection
  const [selectedLedgerCode, setSelectedLedgerCode] = React.useState<string>(params.account || "1101");
  const [ledgerDate, setLedgerDate] = React.useState("");

  if (params.account && selectedLedgerCode !== params.account) {
    setSelectedLedgerCode(params.account);
    setActiveTab("ledger");
  }

  // Modal: Create Manual Journal
  const [manualModalOpen, setManualModalOpen] = React.useState(false);
  const [mjDate, setMjDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [mjRef, setMjRef] = React.useState("");
  const [mjDesc, setMjDesc] = React.useState("");
  const [mjLines, setMjLines] = React.useState<ManualJournalLine[]>([
    { kodeAkun: "1101", keterangan: "", debit: 0, kredit: 0 },
    { kodeAkun: "3101", keterangan: "", debit: 0, kredit: 0 },
  ]);

  // Modal: Create Custom COA Account
  const [coaModalOpen, setCoaModalOpen] = React.useState(false);
  const [newAccCode, setNewAccCode] = React.useState("");
  const [newAccName, setNewAccName] = React.useState("");
  const [newAccCategory, setNewAccCategory] = React.useState<CoaAccount["category"]>("Aset Lancar");
  const [newAccNormalBalance, setNewAccNormalBalance] = React.useState<"DEBIT" | "KREDIT">("DEBIT");
  const [newAccParentCode, setNewAccParentCode] = React.useState<string>("");

  // Refresh Trigger for Reactivity
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  const refreshAccountingData = React.useCallback(async () => {
    setRefreshTrigger((k) => k + 1);
    await Promise.allSettled([
      refreshModule("invoiceIn"),
      refreshModule("supplier-pos"),
      refreshModule("invoices"),
      refreshModule("expenses"),
    ]);
  }, [refreshModule]);

  // Server-side Ledger & Journal Data
  const [serverLedgerLines, setServerLedgerLines] = React.useState<any[] | null>(null);
  const [serverJournalLines, setServerJournalLines] = React.useState<JournalLine[] | null>(null);
  const [serverTrialBalance, setServerTrialBalance] = React.useState<any | null>(null);
  const [serverIncomeStatement, setServerIncomeStatement] = React.useState<any | null>(null);
  const [serverBalanceSheet, setServerBalanceSheet] = React.useState<any | null>(null);

  // Initial sync: fetch custom COA and manual journals once on mount or when explicit refresh triggered
  React.useEffect(() => {
    let active = true;
    api<{ items?: any[] }>("GET", "/coa-accounts")
      .then((res) => {
        if (!active || !Array.isArray(res?.items) || res.items.length === 0) return;
        const dbAccounts: CoaAccount[] = res.items.map((item: any) => ({
          code: String(item.code),
          name: String(item.name),
          category: item.category as CoaAccount["category"],
          normalBalance: (item.normalBalance === "KREDIT" ? "KREDIT" : "DEBIT") as "DEBIT" | "KREDIT",
          ...(item.type ? { type: String(item.type) } : {}),
          ...(item.parentCode ? { parentCode: String(item.parentCode) } : {}),
        }));
        setCustomAccounts((prev) => {
          const mergedMap = new Map<string, CoaAccount>();
          prev.forEach((a) => mergedMap.set(a.code, a));
          dbAccounts.forEach((a) => mergedMap.set(a.code, a));
          const merged = Array.from(mergedMap.values());
          saveCustomCoa(merged);
          return merged;
        });
      })
      .catch(() => {});

    api<{ items?: any[] }>("GET", "/manual-journals")
      .then((res) => {
        if (!active || !Array.isArray(res?.items) || res.items.length === 0) return;
        const dbJournals: ManualJournal[] = res.items.map((r: any) => ({
          id: String(r.id || r.journalNo),
          journalNo: r.journalNo,
          tanggal: r.date || r.tanggal,
          refNo: r.refNo || "-",
          keterangan: r.description || r.keterangan,
          project: r.project || "-",
          createdBy: r.createdBy || "Admin Finance",
          createdAt: r.createdAt,
          lines: typeof r.lines === "string" ? JSON.parse(r.lines) : r.lines,
        }));
        setManualJournals((prev) => {
          const map = new Map<string, ManualJournal>();
          prev.forEach((j) => map.set(j.journalNo || j.id, j));
          dbJournals.forEach((j) => map.set(j.journalNo || j.id, j));
          const merged = Array.from(map.values());
          saveManualJournals(merged);
          return merged;
        });
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [refreshTrigger]);

  // Fetch Journals & Trial Balance directly from backend DB
  React.useEffect(() => {
    let active = true;

    const jParams = new URLSearchParams();
    if (journalDate) {
      jParams.set("startDate", `${journalDate.slice(0, 10)}T00:00:00Z`);
      jParams.set("endDate", `${journalDate.slice(0, 10)}T23:59:59Z`);
    }
    jParams.set("limit", "150");
    const jStr = jParams.toString();
    api<any>("GET", `/accounting/journals${jStr ? `?${jStr}` : ""}`)
      .then((res) => {
        if (!active || !Array.isArray(res?.items)) return;
        const currentAccounts = allAccountsMapRef.current || CHART_OF_ACCOUNTS;
        const mappedLines: JournalLine[] = [];
        res.items.forEach((entry: any) => {
          let entryRef = entry.refNo || "-";
          if (entry.sourceType === "Expense" && entry.sourceId && (!entryRef || /^\d+$/.test(entryRef))) {
            const expCode = `EXP-${String(entry.sourceId).padStart(3, "0")}`;
            entryRef = entry.event === "paid" || entry.source === "EXPENSE_PAYMENT" ? `${expCode}/PAY` : expCode;
          } else if (entry.sourceType === "Payment" || entry.source === "INVOICE_OUT_PAYMENT" || entry.source === "INVOICE_IN_PAYMENT") {
            if (entryRef !== "-" && !entryRef.endsWith("/PAY")) {
              entryRef = `${entryRef}/PAY`;
            }
          }

          (entry.lines || []).forEach((line: any) => {
            const acc = currentAccounts[line.accountCode] || CHART_OF_ACCOUNTS[line.accountCode];
            mappedLines.push({
              id: String(line.id),
              journalNo: entry.number || `JU-${entry.id}`,
              tanggal: formatJournalDateTime(entry.date, entry.createdAt),
              refNo: entryRef,
              sumber:
                entry.source === "EXPENSE"
                  ? "Pengeluaran (Expense)"
                  : entry.source === "EXPENSE_PAYMENT"
                  ? "Pelunasan Expense"
                  : entry.source === "DELIVERY"
                  ? "Pengiriman Barang"
                  : entry.source === "RECEIVING"
                  ? "Penerimaan Barang"
                  : entry.source === "RETAIL_PURCHASE" || entry.source === "PURCHASE_REQUEST"
                  ? "Pembelian Ritel"
                  : entry.source === "INVOICE_OUT"
                  ? "Faktur Pelanggan"
                  : entry.source === "INVOICE_OUT_PAYMENT"
                  ? "Pembayaran Faktur"
                  : entry.source === "INVOICE_IN"
                  ? "PO Pemasok"
                  : entry.source === "INVOICE_IN_PAYMENT"
                  ? "Pelunasan PO"
                  : entry.source === "MANUAL"
                  ? "Jurnal Manual"
                  : (entry.source || "Jurnal"),
              keterangan: line.memo || entry.memo || "-",
              project: line.projectId ? `Project #${line.projectId}` : entry.projectId ? `Project #${entry.projectId}` : "-",
              kodeAkun: line.accountCode,
              namaAkun: acc?.name || line.accountCode,
              debit: Number(line.debit || 0),
              kredit: Number(line.credit || 0),
              manualJournalId: entry.source === "MANUAL" ? String(entry.id) : undefined,
            });
          });
        });
        setServerJournalLines(mappedLines);
      })
      .catch(() => {
        if (active) setServerJournalLines(null);
      });

    // Fetch Trial Balance directly from backend DB
    api<any>("GET", "/accounting/trial-balance")
      .then((res) => {
        if (!active || !res?.rows) return;
        setServerTrialBalance(res);
      })
      .catch(() => {
        if (active) setServerTrialBalance(null);
      });

    // Fetch Income Statement directly from backend DB
    api<any>("GET", "/accounting/income-statement")
      .then((res) => {
        if (!active || !res) return;
        setServerIncomeStatement(res);
      })
      .catch(() => {
        if (active) setServerIncomeStatement(null);
      });

    // Fetch Balance Sheet directly from backend DB
    api<any>("GET", "/accounting/balance-sheet")
      .then((res) => {
        if (!active || !res) return;
        setServerBalanceSheet(res);
      })
      .catch(() => {
        if (active) setServerBalanceSheet(null);
      });

    return () => {
      active = false;
    };
  }, [journalDate, refreshTrigger]);

  React.useEffect(() => {
    let active = true;
    const query = new URLSearchParams();
    if (selectedLedgerCode) query.set("accountCode", selectedLedgerCode);
    if (ledgerDate) {
      query.set("startDate", `${ledgerDate.slice(0, 10)}T00:00:00Z`);
      query.set("endDate", `${ledgerDate.slice(0, 10)}T23:59:59Z`);
    }
    const qStr = query.toString();
    api<any[]>("GET", `/accounting/ledger${qStr ? `?${qStr}` : ""}`)
      .then((res) => {
        if (!active || !Array.isArray(res)) return;
        setServerLedgerLines(res);
      })
      .catch(() => {
        if (active) setServerLedgerLines(null);
      });

    return () => {
      active = false;
    };
  }, [selectedLedgerCode, ledgerDate, refreshTrigger]);

  // Handlers
  const handleSaveManualJournal = async () => {
    const totDebit = mjLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totKredit = mjLines.reduce((s, l) => s + (Number(l.kredit) || 0), 0);

    if (totDebit === 0 || totKredit === 0) {
      toast("Jumlah nilai debit dan kredit tidak boleh bernilai nol.", "danger");
      return;
    }
    if (totDebit !== totKredit) {
      toast(`Ayat jurnal belum seimbang! Selisih: Rp ${Math.abs(totDebit - totKredit).toLocaleString("id-ID")}`, "danger");
      return;
    }
    if (!mjDesc.trim()) {
      toast("Uraian / keterangan transaksi wajib diisi.", "danger");
      return;
    }

    const nextId = `MJ-${Date.now()}`;
    const newJournal: ManualJournal = {
      id: nextId,
      journalNo: `JM-${String(manualJournals.length + 1).padStart(4, "0")}`,
      tanggal: mjDate,
      keterangan: mjDesc.trim(),
      refNo: mjRef.trim() || "-",
      createdBy: user?.name || "Admin Finance",
      createdAt: new Date().toISOString(),
      lines: mjLines.map((l) => ({
        kodeAkun: l.kodeAkun,
        keterangan: l.keterangan || mjDesc.trim(),
        debit: Number(l.debit) || 0,
        kredit: Number(l.kredit) || 0,
      })),
    };

    const nextList = [newJournal, ...manualJournals];
    setManualJournals(nextList);
    saveManualJournals(nextList);

    // Optimistically prepend to serverJournalLines for instant UI update
    if (serverJournalLines) {
      const optimisticLines: JournalLine[] = mjLines.map((l, idx) => {
        const acc = allAccountsMap[l.kodeAkun];
        return {
          id: `${nextId}-${idx}`,
          journalNo: newJournal.journalNo || `JM-${nextId}`,
          tanggal: mjDate,
          refNo: mjRef.trim() || "-",
          sumber: "MANUAL",
          keterangan: l.keterangan || mjDesc.trim(),
          project: "-",
          kodeAkun: l.kodeAkun,
          namaAkun: acc?.name || l.kodeAkun,
          debit: Number(l.debit) || 0,
          kredit: Number(l.kredit) || 0,
          manualJournalId: nextId,
        };
      });
      setServerJournalLines((prev) => (prev ? [...optimisticLines, ...prev] : optimisticLines));
    }

    setManualModalOpen(false);
    setMjDesc("");
    setMjRef("");
    setMjLines([
      { kodeAkun: "1101", keterangan: "", debit: 0, kredit: 0 },
      { kodeAkun: "3101", keterangan: "", debit: 0, kredit: 0 },
    ]);

    try {
      await Promise.allSettled([
        api("POST", "/manual-journals", newJournal),
        api("POST", "/accounting/journals/manual", {
          date: mjDate,
          memo: mjDesc.trim(),
          refNo: mjRef.trim() || undefined,
          lines: mjLines.map((l, idx) => ({
            accountCode: l.kodeAkun,
            lineNo: idx + 1,
            debit: Number(l.debit) || 0,
            credit: Number(l.kredit) || 0,
            memo: l.keterangan || mjDesc.trim(),
          })),
        }),
      ]);
    } finally {
      await refreshAccountingData();
    }

    toast("Ayat jurnal manual berhasil disimpan ke buku besar akuntansi.", "success");
  };

  const handleSaveCustomAccount = async () => {
    const code = newAccCode.trim();
    const name = newAccName.trim();
    if (!code || !name) {
      toast("Kode akun dan nama akun wajib diisi.", "danger");
      return;
    }
    if (allAccountsMap[code]) {
      toast(`Kode akun [${code}] sudah digunakan oleh akun lain.`, "danger");
      return;
    }

    const inferredParent =
      newAccParentCode && newAccParentCode !== "-"
        ? newAccParentCode
        : code.includes(".")
          ? code.split(".")[0]
          : undefined;

    const isCashAccount =
      inferredParent === "1000" ||
      code.startsWith("1000.") ||
      (newAccCategory === "Aset Lancar" &&
        (name.toLowerCase().includes("bank") || name.toLowerCase().includes("kas")));

    const newAcc: CoaAccount = {
      code,
      name,
      category: newAccCategory,
      normalBalance: newAccNormalBalance,
      ...(inferredParent ? { parentCode: inferredParent } : {}),
      isCash: isCashAccount,
      isPostable: true,
    };

    const next = [...customAccounts, newAcc];
    setCustomAccounts(next);
    saveCustomCoa(next);
    setCoaModalOpen(false);
    setNewAccCode("");
    setNewAccName("");
    setNewAccParentCode("");

    const accountPayload = {
      code,
      name,
      category: newAccCategory,
      normalBalance: newAccNormalBalance,
      parentCode: inferredParent || null,
      isCash: isCashAccount,
      isPostable: true,
      status: "AKTIF",
    };

    try {
      await Promise.allSettled([
        api("POST", "/accounting/accounts", accountPayload),
        api("POST", "/coa-accounts", accountPayload),
      ]);
    } finally {
      await refreshAccountingData();
    }

    toast(`Akun [${code}] ${name} berhasil ditambahkan ke COA.`, "success");
  };

  const handleDeleteCoaAccount = async () => {
    if (!deleteCoaTarget) return;
    const targetCode = deleteCoaTarget.code;

    const nextCustom = customAccounts.filter((a) => a.code !== targetCode);
    setCustomAccounts(nextCustom);
    saveCustomCoa(nextCustom);

    if (CHART_OF_ACCOUNTS[targetCode]) {
      const nextDeleted = Array.from(new Set([...deletedCoaCodes, targetCode]));
      setDeletedCoaCodes(nextDeleted);
      saveDeletedCoaCodes(nextDeleted);
    }
    setDeleteCoaTarget(null);

    try {
      await Promise.allSettled([
        api("DELETE", `/accounting/accounts/${encodeURIComponent(targetCode)}`),
        api("DELETE", `/coa-accounts/${encodeURIComponent(targetCode)}`),
      ]);
    } finally {
      await refreshAccountingData();
    }

    toast(`Akun [${targetCode}] ${deleteCoaTarget.name} berhasil dihapus dari COA.`, "success");
  };

  const handleDeleteManualJournal = async () => {
    if (!deleteJournalTarget) return;
    const targetId = deleteJournalTarget.id;
    const targetNo = deleteJournalTarget.journalNo || "";
    const nextList = manualJournals.filter((j) => j.id !== targetId && j.journalNo !== targetNo);
    setManualJournals(nextList);
    saveManualJournals(nextList);
    if (serverJournalLines) {
      setServerJournalLines((prev) =>
        prev
          ? prev.filter((l) => l.manualJournalId !== targetId && l.journalNo !== targetNo && l.id !== targetId)
          : null
      );
    }
    setDeleteJournalTarget(null);
    const numId = parseInt(targetId, 10);
    const promises: Promise<any>[] = [];
    if (!isNaN(numId)) {
      promises.push(api("POST", `/accounting/journals/${numId}/reverse`, { reason: "Dihapus oleh pengguna" }));
    }
    promises.push(api("DELETE", `/manual-journals/${encodeURIComponent(targetId || targetNo)}`));
    await Promise.allSettled(promises);
    await refreshAccountingData();
    toast(`Ayat jurnal manual ${targetNo ? `[${targetNo}] ` : ""}berhasil dihapus / dibalik.`, "success");
  };

  const handleExportJournalCsv = () => {
    const headers = ["No. Jurnal", "Tanggal", "Referensi", "Sumber", "Kode Akun", "Nama Akun", "Keterangan", "Debit", "Kredit"];
    const rows = fin.journalLines.map((l) => [
      l.journalNo,
      l.tanggal,
      `"${l.refNo.replace(/"/g, '""')}"`,
      `"${l.sumber.replace(/"/g, '""')}"`,
      l.kodeAkun,
      `"${l.namaAkun.replace(/"/g, '""')}"`,
      `"${l.keterangan.replace(/"/g, '""')}"`,
      l.debit,
      l.kredit,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    if (typeof window !== "undefined") {
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Jurnal_Umum_TASKA_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    toast("File CSV Jurnal Umum berhasil diexport.", "success");
  };

  // Filtered Journal & Pagination
  const effectiveJournalLines = serverJournalLines && serverJournalLines.length > 0 ? serverJournalLines : fin.journalLines;
  const filteredJournal = effectiveJournalLines.filter((l) => {
    if (!l) return false;
    if (journalSourceFilter !== "Semua" && l.sumber !== journalSourceFilter) return false;
    if (journalDate) {
      const target = journalDate.slice(0, 10);
      if (!l.tanggal?.startsWith(target)) return false;
    }
    if (!journalQuery.trim()) return true;
    const q = journalQuery.toLowerCase();
    return (
      (l.journalNo || "").toLowerCase().includes(q) ||
      (l.refNo || "").toLowerCase().includes(q) ||
      (l.kodeAkun || "").toLowerCase().includes(q) ||
      (l.namaAkun || "").toLowerCase().includes(q) ||
      (l.keterangan || "").toLowerCase().includes(q) ||
      (l.project || "").toLowerCase().includes(q)
    );
  });

  const totalJournalPages = Math.max(1, Math.ceil(filteredJournal.length / JOURNAL_PAGE_SIZE));
  const currentJournalPage = Math.min(Math.max(1, journalPage), totalJournalPages);
  const pagedJournal = filteredJournal.slice(
    (currentJournalPage - 1) * JOURNAL_PAGE_SIZE,
    currentJournalPage * JOURNAL_PAGE_SIZE
  );

  const effectiveTotalDebit = React.useMemo(
    () => effectiveJournalLines.reduce((s, l) => s + (Number(l.debit) || 0), 0),
    [effectiveJournalLines]
  );
  const effectiveTotalKredit = React.useMemo(
    () => effectiveJournalLines.reduce((s, l) => s + (Number(l.kredit) || 0), 0),
    [effectiveJournalLines]
  );

  // Filtered COA & Pagination
  const effectiveCoaBalances = React.useMemo(() => {
    return buildCoaTree(
      allAccountsMap,
      serverTrialBalance?.rows || [],
      deletedCoaCodes
    );
  }, [allAccountsMap, serverTrialBalance, deletedCoaCodes]);

  const filteredCoa = (effectiveCoaBalances || []).filter((acc:any) => {
    if (!acc) return false;
    if (coaCategoryFilter !== "Semua" && acc.category !== coaCategoryFilter) return false;
    if (!coaQuery.trim()) return true;
    const q = coaQuery.toLowerCase();
    return (acc.code || "").toLowerCase().includes(q) || (acc.name || "").toLowerCase().includes(q);
  });

  const totalCoaPages = Math.max(1, Math.ceil(filteredCoa.length / COA_PAGE_SIZE));
  const currentCoaPage = Math.min(Math.max(1, coaPage), totalCoaPages);
  const pagedCoa = filteredCoa.slice(
    (currentCoaPage - 1) * COA_PAGE_SIZE,
    currentCoaPage * COA_PAGE_SIZE
  );

  // Ledger Lines for Selected Account (termasuk mutasi dari akun children / sub-accounts bila akun parent)
  const selectedAcc =
    allAccountsMap[selectedLedgerCode] ||
    effectiveCoaBalances.find((b: any) => b.code === selectedLedgerCode) ||
    CHART_OF_ACCOUNTS[selectedLedgerCode] ||
    effectiveCoaBalances[0];

  const ledgerLines = React.useMemo(() => {
    const targetCodes = new Set<string>();
    targetCodes.add(selectedLedgerCode);

    // Kumpulkan turunan rekursif dari parentCode atau prefiks titik (dot notation)
    const collectDescendantCodes = (parentCode: string) => {
      const allList: any[] = [
        ...Object.values(allAccountsMap),
        ...(effectiveCoaBalances || []),
      ];
      allList.forEach((acc) => {
        if (!acc?.code) return;
        if (acc.parentCode === parentCode || acc.code.startsWith(`${parentCode}.`)) {
          if (!targetCodes.has(acc.code)) {
            targetCodes.add(acc.code);
            collectDescendantCodes(acc.code);
          }
        }
      });
    };
    collectDescendantCodes(selectedLedgerCode);

    if (Array.isArray(serverLedgerLines) && serverLedgerLines.length > 0) {
      let balance = 0;
      return serverLedgerLines.map((l: any) => {
        const debit = Number(l.debit || 0);
        const credit = Number(l.credit || 0);
        balance += selectedAcc?.normalBalance === "DEBIT" ? debit - credit : credit - debit;
        const sumberLabel =
          l.source === "EXPENSE"
            ? "Pengeluaran (Expense)"
            : l.source === "EXPENSE_PAYMENT"
            ? "Pelunasan Expense"
            : l.source === "MANUAL"
            ? "Jurnal Manual"
            : l.source === "INVOICE_OUT"
            ? "Faktur Pelanggan"
            : l.source === "INVOICE_OUT_PAYMENT"
            ? "Pembayaran Faktur"
            : l.source === "DELIVERY"
            ? "Pengiriman Barang"
            : l.source === "RECEIVING"
            ? "Penerimaan Barang"
            : l.source === "INVOICE_IN"
            ? "PO Pemasok"
            : l.source === "INVOICE_IN_PAYMENT"
            ? "Pelunasan PO"
            : l.source || (l.partyType ? `${l.partyType} #${l.partyId}` : "Jurnal");

        return {
          id: String(l.id),
          journalNo: l.entryNumber || l.journalNo || `JU-${l.entryId}`,
          tanggal: formatJournalDateTime(l.date, l.createdAt),
          refNo: l.refNo || "-",
          kodeAkun: l.accountCode,
          sumber: sumberLabel,
          keterangan: l.memo || "-",
          debit,
          kredit: credit,
          runningBalance: balance,
        };
      });
    }

    // Filter langsung dari effectiveJournalLines yang memuat seluruh transaksi server
    let matching = (effectiveJournalLines || [])
      .filter((l) => targetCodes.has(l.kodeAkun))
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

    if (ledgerDate) {
      const target = ledgerDate.slice(0, 10);
      matching = matching.filter((l) => l.tanggal?.startsWith(target));
    }

    let balance = 0;
    return matching.map((l) => {
      balance += selectedAcc?.normalBalance === "DEBIT" ? l.debit - l.kredit : l.kredit - l.debit;
      return {
        ...l,
        runningBalance: balance,
      };
    });
  }, [
    serverLedgerLines,
    effectiveJournalLines,
    selectedLedgerCode,
    ledgerDate,
    selectedAcc,
    allAccountsMap,
    effectiveCoaBalances,
  ]);

  const finForSummary = React.useMemo(() => {
    const sumAccounts = (items: any[] = [], prefixes: string[]) => {
      if (Array.isArray(items) && items.length > 0) {
        return items
          .filter((i: any) => prefixes.some((p) => i.code === p || i.code.startsWith(`${p}.`)))
          .reduce((sum: number, i: any) => sum + Number(i.amount || 0), 0);
      }
      return (effectiveCoaBalances || [])
        .filter((a: any) => !a.isHeader && prefixes.some((p) => a.code === p || a.code.startsWith(`${p}.`)))
        .reduce((sum: number, a: any) => sum + Number(a.endingBalance || 0), 0);
    };

    const coaRevenue = (effectiveCoaBalances || [])
      .filter((a: any) => !a.isHeader && (a.category === "Pendapatan" || a.category === "Pendapatan Diluar Usaha"))
      .reduce((s: number, a: any) => s + (Number(a.endingBalance) || 0), 0);

    const coaCogs = (effectiveCoaBalances || [])
      .filter((a: any) => !a.isHeader && a.category === "Beban Pokok (HPP)")
      .reduce((s: number, a: any) => s + (Number(a.endingBalance) || 0), 0);

    const coaOpex = (effectiveCoaBalances || [])
      .filter((a: any) => !a.isHeader && (a.category === "Beban Operasional" || a.category === "Beban Diluar Usaha"))
      .reduce((s: number, a: any) => s + (Number(a.endingBalance) || 0), 0);

    const coaAssets = (effectiveCoaBalances || [])
      .filter((a: any) => !a.isHeader && a.category?.startsWith("Aset"))
      .reduce((s: number, a: any) => s + (Number(a.endingBalance) || 0), 0);

    const coaLiabilities = (effectiveCoaBalances || [])
      .filter((a: any) => !a.isHeader && a.category?.startsWith("Kewajiban"))
      .reduce((s: number, a: any) => s + (Number(a.endingBalance) || 0), 0);

    const coaEquity = (effectiveCoaBalances || [])
      .filter((a: any) => !a.isHeader && a.category === "Ekuitas")
      .reduce((s: number, a: any) => s + (Number(a.endingBalance) || 0), 0);

    const finalRev = serverIncomeStatement ? Number(serverIncomeStatement.revenue?.total || 0) : coaRevenue;
    const finalCogs = serverIncomeStatement ? Number(serverIncomeStatement.cogs?.total || 0) : coaCogs;
    const finalOpex = serverIncomeStatement ? Number(serverIncomeStatement.operatingExpense?.total || 0) : coaOpex;
    const grossProfit = Number(serverIncomeStatement?.grossProfit ?? (finalRev - finalCogs));
    const netProfit = Number(serverIncomeStatement?.netProfit ?? (grossProfit - finalOpex));
    const grossMarginPct = finalRev > 0 ? Number(((grossProfit / finalRev) * 100).toFixed(1)) : 0;
    const netMarginPct = finalRev > 0 ? Number(((netProfit / finalRev) * 100).toFixed(1)) : 0;

    const assetsTotal = serverBalanceSheet ? Number(serverBalanceSheet.assets?.total || 0) : coaAssets;
    const liabTotal = serverBalanceSheet ? Number(serverBalanceSheet.liabilities?.total || 0) : coaLiabilities;
    const eqTotal = serverBalanceSheet ? Number(serverBalanceSheet.equity?.total || 0) : (coaEquity + netProfit);
    const totalPasiva = serverBalanceSheet ? Number(serverBalanceSheet.totalLiabilitiesAndEquity || (liabTotal + eqTotal)) : (liabTotal + eqTotal);

    return {
      ...fin,
      coaBalances: effectiveCoaBalances,
      journalLines: effectiveJournalLines,
      totalDebit: effectiveTotalDebit,
      totalKredit: effectiveTotalKredit,
      incomeStatement: {
        ...fin.incomeStatement,
        revenueDpp: finalRev,
        cogsTotal: finalCogs,
        grossProfit,
        grossMarginPct,
        opexTotal: finalOpex,
        netProfit,
        netMarginPct,
      },
      balanceSheet: {
        ...fin.balanceSheet,
        totalPasiva,
        assets: {
          ...fin.balanceSheet.assets,
          items: serverBalanceSheet?.assets?.items || [],
          totalAsetLancar: assetsTotal,
          kasDanBank: sumAccounts(serverBalanceSheet?.assets?.items, ["1000", "1101"]),
          piutangUsaha: sumAccounts(serverBalanceSheet?.assets?.items, ["1100", "1102", "110302", "110303"]),
          persediaanBarang: sumAccounts(serverBalanceSheet?.assets?.items, ["1200", "1103"]),
          ppnMasukan: sumAccounts(serverBalanceSheet?.assets?.items, ["1600", "1104"]),
          uangMukaPph: sumAccounts(serverBalanceSheet?.assets?.items, ["1105", "1106"]),
        },
        liabilities: {
          ...fin.balanceSheet.liabilities,
          items: serverBalanceSheet?.liabilities?.items || [],
          totalKewajiban: liabTotal,
          hutangSupplier: sumAccounts(serverBalanceSheet?.liabilities?.items, ["2101", "210102"]),
          hutangPpnKeluaran: sumAccounts(serverBalanceSheet?.liabilities?.items, ["2100", "2102"]),
          hutangReimbursement: sumAccounts(serverBalanceSheet?.liabilities?.items, ["2103"]),
        },
        equity: {
          ...fin.balanceSheet.equity,
          items: serverBalanceSheet?.equity?.items || [],
          modalKerjaAwal: sumAccounts(serverBalanceSheet?.equity?.items, ["3101", "310001", "3000"]),
          labaBerjalan: sumAccounts(serverBalanceSheet?.equity?.items, ["3102-AUTO", "3102"]),
          totalEkuitas: eqTotal,
        },
      },
    };
  }, [
    fin,
    effectiveCoaBalances,
    effectiveJournalLines,
    effectiveTotalDebit,
    effectiveTotalKredit,
    serverIncomeStatement,
    serverBalanceSheet,
  ]);

  if (!canAccess) {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16 }}>
        <View className="py-20 items-center justify-center gap-3">
          <Text className="text-base font-bold text-foreground">Akses Terbatas</Text>
          <Text className="text-xs text-muted-foreground text-center max-w-sm">
            Menu Pembukuan Akuntansi & Jurnal hanya dapat diakses oleh Manajemen (Super Admin, Bos, Admin) dan Divisi Finance.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: 64 }}>
      <View className="gap-5 w-full">
        <PageHeader
          title="Akuntansi & Pembukuan"
          subtitle="Sistem Pembukuan Berpasangan (Double-Entry General Journal, COA Standar, dan Buku Besar)"
          showRefresh={true}
          onRefresh={refreshAccountingData}
          action={
            <Button size="sm" onPress={() => setManualModalOpen(true)} className="gap-1.5 h-9 px-3">
              <Plus size={14} color="#FFFFFF" />
              <Text className="text-xs font-semibold text-white" style={{ color: "#FFFFFF" }}>
                Input Jurnal Manual
              </Text>
            </Button>
          }
        />

        {/* Tab Switcher */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="w-full">
          <View className="bg-panel border-border/80 flex-row items-center rounded-2xl border p-1.5 gap-1.5">
            {[
              { id: "journal", label: "Jurnal Umum", icon: BookOpen, count: effectiveJournalLines.length },
              { id: "coa", label: "Bagan Akun (COA)", icon: Scale, count: effectiveCoaBalances.length },
              { id: "ledger", label: "Buku Besar", icon: FileText, count: ledgerLines.length },
              { id: "summary", label: "Ringkasan Saldo", icon: TrendingUp, count: null },
              { id: "tax", label: "Pajak & PPN", icon: Scale, count: null },
              { id: "period", label: "Tutup Buku", icon: BookOpen, count: null },
              { id: "return", label: "Retur Barang", icon: BookOpen, count: null },
            ].map((t) => {
              const active = activeTab === t.id;
              const IconComp = t.icon;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setActiveTab(t.id as AccountingTab)}
                  className={`flex-row items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                    active ? "bg-primary shadow-sm" : "hover:bg-card/60"
                  }`}
                >
                  <IconComp size={15} color={active ? "#FFFFFF" : colors.textSecondary} />
                  <Text
                    className={`text-xs font-semibold ${
                      active ? "text-white" : "text-muted-foreground"
                    }`}
                  >
                    {t.label}
                  </Text>
                  {t.count !== null && (
                    <View
                      className={`rounded-full px-1.5 py-0.2 min-w-[18px] items-center justify-center ${
                        active ? "bg-white/20" : "bg-panel border border-border/60"
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-bold ${
                          active ? "text-white" : "text-muted-foreground"
                        }`}
                      >
                        {t.count}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* TAB 1: JURNAL UMUM */}
        {activeTab === "journal" && (
          <JournalTab
            fin={{
              ...fin,
              totalDebit: effectiveTotalDebit,
              totalKredit: effectiveTotalKredit,
            }}
            onRefresh={refreshAccountingData}
            handleExportJournalCsv={handleExportJournalCsv}
            journalQuery={journalQuery}
            setJournalQuery={setJournalQuery}
            journalDate={journalDate}
            setJournalDate={setJournalDate}
            journalPage={journalPage}
            setJournalPage={setJournalPage}
            journalSourceFilter={journalSourceFilter}
            setJournalSourceFilter={setJournalSourceFilter}
            filteredJournal={filteredJournal}
            pagedJournal={pagedJournal}
            currentJournalPage={currentJournalPage}
            totalJournalPages={totalJournalPages}
            JOURNAL_PAGE_SIZE={JOURNAL_PAGE_SIZE}
            setJournalPageSize={(s) => {
              setJournalPageSize(s);
              setJournalPage(1);
            }}
            onSelectAccount={(code) => {
              setSelectedLedgerCode(code);
              setActiveTab("ledger");
            }}
            onDeleteManualJournal={(t) => setDeleteJournalTarget(t)}
          />
        )}

        {/* TAB 2: BAGAN AKUN (COA) & NERACA SALDO */}
        {activeTab === "coa" && (
          <CoaTab
            onOpenCreateCoa={() => setCoaModalOpen(true)}
            onRefresh={refreshAccountingData}
            coaQuery={coaQuery}
            setCoaQuery={setCoaQuery}
            setCoaPage={setCoaPage}
            coaCategoryFilter={coaCategoryFilter}
            setCoaCategoryFilter={setCoaCategoryFilter}
            pagedCoa={pagedCoa}
            filteredCoa={filteredCoa}
            currentCoaPage={currentCoaPage}
            totalCoaPages={totalCoaPages}
            COA_PAGE_SIZE={COA_PAGE_SIZE}
            setCoaPageSize={(s) => {
              setCoaPageSize(s);
              setCoaPage(1);
            }}
            onSelectLedger={(code) => {
              setSelectedLedgerCode(code);
              setActiveTab("ledger");
            }}
            onDeleteCoa={(acc) => {
              if (acc.totalDebit > 0 || acc.totalKredit > 0) {
                toast(`Akun [${acc.code}] memiliki transaksi mutasi dan tidak dapat dihapus.`, "danger");
                return;
              }
              setDeleteCoaTarget(acc);
            }}
          />
        )}

        {/* TAB 3: BUKU BESAR PEMBANTU (LEDGER PER AKUN) */}
        {activeTab === "ledger" && (
          <LedgerTab
            selectedAcc={selectedAcc}
            selectedLedgerCode={selectedLedgerCode}
            setSelectedLedgerCode={setSelectedLedgerCode}
            ledgerDate={ledgerDate}
            setLedgerDate={setLedgerDate}
            fin={finForSummary}
            ledgerLines={ledgerLines}
          />
        )}

        {/* TAB 4: IKHTISAR KEUANGAN & NERACA */}
        {activeTab === "summary" && (
          <SummaryTab
            fin={finForSummary}
            onNavigateToReports={(tab) => router.push(`/reports?tab=${tab}` as any)}
          />
        )}

        {/* TAB 5: PAJAK & PPN */}
        {activeTab === "tax" && <TaxTab onRefreshParent={refreshAccountingData} />}

        {/* TAB 6: TUTUP BUKU */}
        {activeTab === "period" && <PeriodTab onRefreshParent={refreshAccountingData} />}

        {/* TAB 7: RETUR BARANG */}
        {activeTab === "return" && <ReturnTab onRefreshParent={refreshAccountingData} />}
      </View>

      {/* MODAL: INPUT JURNAL MANUAL */}
      <ManualJournalDialog
        open={manualModalOpen}
        onOpenChange={setManualModalOpen}
        mjDate={mjDate}
        setMjDate={setMjDate}
        mjRef={mjRef}
        setMjRef={setMjRef}
        mjDesc={mjDesc}
        setMjDesc={setMjDesc}
        mjLines={mjLines}
        setMjLines={setMjLines}
        allAccountsMap={allAccountsMap}
        onSave={handleSaveManualJournal}
      />

      {/* MODAL: TAMBAH AKUN COA BARU */}
      <CreateCoaDialog
        open={coaModalOpen}
        onOpenChange={setCoaModalOpen}
        newAccCode={newAccCode}
        setNewAccCode={setNewAccCode}
        newAccName={newAccName}
        setNewAccName={setNewAccName}
        newAccCategory={newAccCategory}
        setNewAccCategory={setNewAccCategory}
        newAccNormalBalance={newAccNormalBalance}
        setNewAccNormalBalance={setNewAccNormalBalance}
        newAccParentCode={newAccParentCode}
        setNewAccParentCode={setNewAccParentCode}
        parentOptions={effectiveCoaBalances.map((row) => ({
          code: row.code,
          name: row.name,
          category: row.category,
          normalBalance: row.normalBalance,
          parentCode: row.parentCode,
        }))}
        onSave={handleSaveCustomAccount}
      />

      {/* Dialog Konfirmasi Hapus Akun COA */}
      <ConfirmDialog
        open={!!deleteCoaTarget}
        onOpenChange={(v) => !v && setDeleteCoaTarget(null)}
        title="Hapus Akun COA?"
        description={`Apakah Anda yakin ingin menghapus akun [${deleteCoaTarget?.code}] ${deleteCoaTarget?.name}? Akun yang dihapus tidak akan lagi muncul di bagan akun (COA).`}
        confirmLabel="Ya, Hapus Akun"
        destructive
        onConfirm={handleDeleteCoaAccount}
      />

      {/* Dialog Konfirmasi Hapus Ayat Jurnal Manual */}
      <ConfirmDialog
        open={!!deleteJournalTarget}
        onOpenChange={(v) => !v && setDeleteJournalTarget(null)}
        title="Hapus Ayat Jurnal Manual?"
        description={`Apakah Anda yakin ingin menghapus seluruh ayat jurnal manual [${deleteJournalTarget?.journalNo || "-"}] (${deleteJournalTarget?.keterangan || "-"})? Entri debit dan kredit terkait akan ditiadakan dari buku besar.`}
        confirmLabel="Ya, Hapus Jurnal"
        destructive
        onConfirm={handleDeleteManualJournal}
      />
    </ScrollView>
  );
}
