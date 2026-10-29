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
  type ManualJournal,
  type ManualJournalLine,
  computeFinancialStatements,
  loadManualJournals,
  saveManualJournals,
  loadCustomCoa,
  saveCustomCoa,
  loadDeletedCoaCodes,
  saveDeletedCoaCodes,
} from "@/lib/accounting";

import { AccountingTab } from "@/modules/accounting/types";
import { JournalTab } from "@/modules/accounting/components/journal-tab";
import { CoaTab } from "@/modules/accounting/components/coa-tab";
import { LedgerTab } from "@/modules/accounting/components/ledger-tab";
import { SummaryTab } from "@/modules/accounting/components/summary-tab";
import { ManualJournalDialog } from "@/modules/accounting/components/manual-journal-dialog";
import { CreateCoaDialog } from "@/modules/accounting/components/create-coa-dialog";

export default function AccountingScreen() {
  const router = useRouter();
  const { data, user, toast } = useApp();
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
    return () => {
      active = false;
    };
  }, []);

  // Ledger Lines for Selected Account
  const selectedAcc = allAccountsMap[selectedLedgerCode] || fin.coaBalances[0];
  const ledgerLines = React.useMemo(() => {
    let matching = fin.journalLines
      .filter((l) => l.kodeAkun === selectedLedgerCode)
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

    if (ledgerDate) {
      const target = ledgerDate.slice(0, 10);
      matching = matching.filter((l) => l.tanggal?.startsWith(target));
    }

    return matching.reduce<{ lines: (typeof matching[0] & { runningBalance: number })[]; balance: number }>(
      (acc, l) => {
        const balance = acc.balance +
          (selectedAcc?.normalBalance === "DEBIT" ? l.debit - l.kredit : l.kredit - l.debit);
        acc.lines.push({ ...l, runningBalance: balance });
        return { lines: acc.lines, balance };
      },
      { lines: [], balance: 0 },
    ).lines;
  }, [fin.journalLines, selectedLedgerCode, selectedAcc, ledgerDate]);

  // Handlers
  const handleSaveManualJournal = () => {
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

    toast("Ayat jurnal manual berhasil disimpan ke buku besar akuntansi.", "success");
    setManualModalOpen(false);
    setMjDesc("");
    setMjRef("");
    setMjLines([
      { kodeAkun: "1101", keterangan: "", debit: 0, kredit: 0 },
      { kodeAkun: "3101", keterangan: "", debit: 0, kredit: 0 },
    ]);
  };

  const handleSaveCustomAccount = () => {
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
    const newAcc: CoaAccount = {
      code,
      name,
      category: newAccCategory,
      normalBalance: newAccNormalBalance,
      ...(inferredParent && allAccountsMap[inferredParent] ? { parentCode: inferredParent } : {}),
    };

    const next = [...customAccounts, newAcc];
    setCustomAccounts(next);
    saveCustomCoa(next);
    void api("POST", "/coa-accounts", newAcc).catch(() => {});

    toast(`Akun [${code}] ${name} berhasil ditambahkan ke COA.`, "success");
    setCoaModalOpen(false);
    setNewAccCode("");
    setNewAccName("");
    setNewAccParentCode("");
  };

  const handleDeleteCoaAccount = () => {
    if (!deleteCoaTarget) return;
    const targetCode = deleteCoaTarget.code;

    const nextCustom = customAccounts.filter((a) => a.code !== targetCode);
    setCustomAccounts(nextCustom);
    saveCustomCoa(nextCustom);
    void api("DELETE", `/coa-accounts/${encodeURIComponent(targetCode)}`).catch(() => {});

    if (CHART_OF_ACCOUNTS[targetCode]) {
      const nextDeleted = Array.from(new Set([...deletedCoaCodes, targetCode]));
      setDeletedCoaCodes(nextDeleted);
      saveDeletedCoaCodes(nextDeleted);
    }

    toast(`Akun [${targetCode}] ${deleteCoaTarget.name} berhasil dihapus dari COA.`, "success");
    setDeleteCoaTarget(null);
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
  const filteredJournal = fin.journalLines.filter((l) => {
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

  // Filtered COA & Pagination
  const filteredCoa = (fin?.coaBalances || []).filter((acc) => {
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
          showRefresh={false}
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
              { id: "journal", label: "Jurnal Umum", icon: BookOpen, count: fin.journalLines.length },
              { id: "coa", label: "Bagan Akun (COA)", icon: Scale, count: fin.coaBalances.length },
              { id: "ledger", label: "Buku Besar", icon: FileText, count: ledgerLines.length },
              { id: "summary", label: "Ringkasan Saldo", icon: TrendingUp, count: null },
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
            fin={fin}
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
          />
        )}

        {/* TAB 2: BAGAN AKUN (COA) & NERACA SALDO */}
        {activeTab === "coa" && (
          <CoaTab
            onOpenCreateCoa={() => setCoaModalOpen(true)}
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
            fin={fin}
            ledgerLines={ledgerLines}
          />
        )}

        {/* TAB 4: IKHTISAR KEUANGAN & NERACA */}
        {activeTab === "summary" && (
          <SummaryTab
            fin={fin}
            onNavigateToReports={(tab) => router.push(`/reports?tab=${tab}` as any)}
          />
        )}
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
        parentOptions={fin.coaBalances.map((row) => ({
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
    </ScrollView>
  );
}
