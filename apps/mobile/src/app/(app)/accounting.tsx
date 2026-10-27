import * as React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Scale,
  TrendingUp,
  FileSpreadsheet,
  FileText,
  ArrowRight,
  Filter,
  Trash2,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader, Panel, FormField } from "@/components/taska/basics";
import { SearchableSelect, DatePicker, formatThousands } from "@/components/taska/dialogs";
import { useApp } from "@/store/app-store";
import { rupiah, tanggal } from "@/lib/format";
import { colors } from "@/tokens";
import {
  CHART_OF_ACCOUNTS,
  type CoaAccount,
  type JournalLine,
  type ManualJournal,
  type ManualJournalLine,
  computeFinancialStatements,
  loadManualJournals,
  saveManualJournals,
  loadCustomCoa,
  saveCustomCoa,
} from "@/lib/accounting";

type AccountingTab = "journal" | "coa" | "ledger" | "summary";

const COA_CATEGORIES: CoaAccount["category"][] = [
  "Aset Lancar",
  "Kewajiban Jangka Pendek",
  "Ekuitas",
  "Pendapatan",
  "Beban Pokok (HPP)",
  "Beban Operasional",
];

export default function AccountingScreen() {
  const router = useRouter();
  const { data, user, toast } = useApp();
  const roleLower = (user?.role || "").toLowerCase();
  const canAccess = ["super_admin", "admin", "bos", "finance"].includes(roleLower);

  const params = useLocalSearchParams<{ tab?: AccountingTab; account?: string }>();
  const [activeTab, setActiveTab] = React.useState<AccountingTab>(params.tab || "journal");

  // Persistent Manual Journals & Custom COA
  const [manualJournals, setManualJournals] = React.useState<ManualJournal[]>(
    () => loadManualJournals(),
  );
  const [customAccounts, setCustomAccounts] = React.useState<CoaAccount[]>(
    () => loadCustomCoa(),
  );

  const fin = React.useMemo(
    () => computeFinancialStatements(data, manualJournals, customAccounts),
    [data, manualJournals, customAccounts],
  );

  // Active COA Map
  const allAccountsMap = React.useMemo(() => {
    const map: Record<string, CoaAccount> = { ...CHART_OF_ACCOUNTS };
    customAccounts.forEach((acc) => {
      map[acc.code] = acc;
    });
    return map;
  }, [customAccounts]);

  // Tab 1: Journal filters
  const [journalQuery, setJournalQuery] = React.useState("");
  const [journalSourceFilter, setJournalSourceFilter] = React.useState<string>("Semua");

  // Tab 2: COA filters
  const [coaQuery, setCoaQuery] = React.useState("");
  const [coaCategoryFilter, setCoaCategoryFilter] = React.useState<string>("Semua");

  // Tab 3: Ledger account selection
  const [selectedLedgerCode, setSelectedLedgerCode] = React.useState<string>(params.account || "1101");

  if (params.account && selectedLedgerCode !== params.account) {
    setSelectedLedgerCode(params.account);
    setActiveTab("ledger");
  }

  // Modal: Create Manual Journal
  const [manualModalOpen, setManualModalOpen] = React.useState(false);
  const [mjDate, setMjDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [mjRef, setMjRef] = React.useState("");
  const [mjDesc, setMjDesc] = React.useState("");
  const [mjProject, setMjProject] = React.useState("");
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

  // Ledger Lines for Selected Account
  const selectedAcc = allAccountsMap[selectedLedgerCode] || fin.coaBalances[0];
  const ledgerLines = React.useMemo(() => {
    const matching = fin.journalLines
      .filter((l) => l.kodeAkun === selectedLedgerCode)
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

    return matching.reduce<{ lines: typeof matching extends Array<infer T> ? (T & { runningBalance: number })[] : never; balance: number }>(
      (acc, l) => {
        const balance = acc.balance +
          (selectedAcc?.normalBalance === "DEBIT" ? l.debit - l.kredit : l.kredit - l.debit);
        acc.lines.push({ ...l, runningBalance: balance });
        return { lines: acc.lines, balance };
      },
      { lines: [], balance: 0 },
    ).lines;
  }, [fin.journalLines, selectedLedgerCode, selectedAcc]);

  if (!canAccess) {
    return (
      <View className="flex-1 items-center justify-center p-6 gap-3">
        <AlertCircle size={40} color={colors.danger} />
        <Text className="text-base font-bold text-foreground">Akses Ditolak</Text>
        <Text className="text-xs text-muted-foreground text-center">
          Halaman Akuntansi & Buku Besar hanya dapat diakses oleh Finance, Admin, Bos, dan Super Admin.
        </Text>
        <Button onPress={() => router.push("/dashboard")}>
          <Text>Kembali ke Dashboard</Text>
        </Button>
      </View>
    );
  }

  // Filtered Journal lines
  const filteredJournal = fin.journalLines.filter((l) => {
    if (journalSourceFilter !== "Semua" && l.sumber !== journalSourceFilter) return false;
    if (!journalQuery.trim()) return true;
    const q = journalQuery.toLowerCase();
    return (
      l.journalNo.toLowerCase().includes(q) ||
      l.refNo.toLowerCase().includes(q) ||
      l.kodeAkun.toLowerCase().includes(q) ||
      l.namaAkun.toLowerCase().includes(q) ||
      l.keterangan.toLowerCase().includes(q) ||
      l.project.toLowerCase().includes(q)
    );
  });

  // Filtered COA
  const filteredCoa = fin.coaBalances.filter((acc) => {
    if (coaCategoryFilter !== "Semua" && acc.category !== coaCategoryFilter) return false;
    if (!coaQuery.trim()) return true;
    const q = coaQuery.toLowerCase();
    return acc.code.toLowerCase().includes(q) || acc.name.toLowerCase().includes(q);
  });

  // Handle Submit Manual Journal
  const handleSaveManualJournal = () => {
    const totDebit = mjLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totKredit = mjLines.reduce((s, l) => s + (Number(l.kredit) || 0), 0);

    if (totDebit === 0 || totKredit === 0) {
      toast("Nominal jurnal tidak boleh Rp 0", "danger");
      return;
    }
    if (totDebit !== totKredit) {
      toast(`Jurnal tidak seimbang! Total Debit (${rupiah(totDebit)}) != Total Kredit (${rupiah(totKredit)})`, "danger");
      return;
    }
    if (!mjDesc.trim()) {
      toast("Uraian / Keterangan jurnal wajib diisi", "danger");
      return;
    }

    const nextId = String(Date.now());
    const nextJournalNo = `JM-${String(manualJournals.length + 1).padStart(4, "0")}`;
    const newEntry: ManualJournal = {
      id: nextId,
      journalNo: nextJournalNo,
      tanggal: mjDate,
      refNo: mjRef.trim() || nextJournalNo,
      keterangan: mjDesc.trim(),
      project: mjProject.trim() || "-",
      lines: mjLines.map((l) => ({
        kodeAkun: l.kodeAkun,
        keterangan: l.keterangan.trim() || mjDesc.trim(),
        debit: Number(l.debit) || 0,
        kredit: Number(l.kredit) || 0,
      })),
    };

    const updated = [newEntry, ...manualJournals];
    setManualJournals(updated);
    saveManualJournals(updated);
    toast(`Jurnal manual ${nextJournalNo} berhasil disimpan`);
    setManualModalOpen(false);
    setMjDesc("");
    setMjRef("");
    setMjLines([
      { kodeAkun: "1101", keterangan: "", debit: 0, kredit: 0 },
      { kodeAkun: "3101", keterangan: "", debit: 0, kredit: 0 },
    ]);
  };

  // Handle Submit Custom COA Account
  const handleSaveCustomAccount = () => {
    const cleanCode = newAccCode.trim();
    const cleanName = newAccName.trim();
    if (!cleanCode || !cleanName) {
      toast("Kode dan Nama Akun wajib diisi", "danger");
      return;
    }
    if (allAccountsMap[cleanCode]) {
      toast(`Kode Akun ${cleanCode} sudah terdaftar!`, "danger");
      return;
    }

    const newAcc: CoaAccount = {
      code: cleanCode,
      name: cleanName,
      category: newAccCategory,
      normalBalance: newAccNormalBalance,
    };

    const updated = [...customAccounts, newAcc];
    setCustomAccounts(updated);
    saveCustomCoa(updated);
    toast(`Akun [${cleanCode}] ${cleanName} berhasil ditambahkan ke COA`);
    setCoaModalOpen(false);
    setNewAccCode("");
    setNewAccName("");
  };

  // Export Journal to CSV
  const handleExportJournalCsv = () => {
    const header = "LAPORAN BUKU JURNAL UMUM - PT GHINA MULTI PRIMA (TASKA ERP)\nTanggal: " + new Date().toISOString().slice(0, 10) + "\n\n";
    const cols = "No Jurnal,Tanggal,No Referensi,Sumber,Project,Kode Akun,Nama Akun,Uraian,Debit (Rp),Kredit (Rp)\n";
    const rows = filteredJournal.map((l) =>
      `"${l.journalNo}","${l.tanggal}","${l.refNo}","${l.sumber}","${l.project}","${l.kodeAkun}","${l.namaAkun}","${l.keterangan}","${l.debit}","${l.kredit}"`
    );
    const csvContent = header + cols + rows.join("\n");
    if (typeof window !== "undefined") {
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jurnal-umum-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast("File Jurnal Umum (.csv) berhasil diunduh");
    }
  };

  return (
    <View className="gap-5 w-full pb-12">
      <PageHeader
        title="Akuntansi, Buku Besar & Bagan Akun (COA)"
        subtitle="Pencatatan Berpasangan SAK (Double-Entry Bookkeeping), Buku Jurnal Umum, Kartu Buku Besar, dan Neraca Saldo"
        action={
          <View className="flex-row items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onPress={() => setCoaModalOpen(true)}
              className="h-9 px-3 gap-1.5"
            >
              <Plus size={14} color={colors.primary} />
              <Text className="text-xs font-semibold text-primary">+ Tambah Akun COA</Text>
            </Button>
            <Button
              size="sm"
              onPress={() => setManualModalOpen(true)}
              className="h-9 px-3 gap-1.5"
            >
              <Plus size={14} color={colors.background} />
              <Text className="text-xs font-semibold">+ Input Jurnal Manual</Text>
            </Button>
          </View>
        }
      />

      {/* KPI Balance & Summary Cards */}
      <View className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
        <View className="bg-card border-border/80 rounded-xl border p-3.5 gap-1">
          <Text className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Total Aset (Aktiva)</Text>
          <Text className="text-base font-extrabold text-foreground">{rupiah(fin.balanceSheet.assets.totalAsetLancar)}</Text>
          <Text className="text-[10px] text-muted-foreground">Kas, Piutang, Stok & Uang Muka PPh</Text>
        </View>

        <View className="bg-card border-border/80 rounded-xl border p-3.5 gap-1">
          <Text className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Total Kewajiban</Text>
          <Text className="text-base font-extrabold text-warning">{rupiah(fin.balanceSheet.liabilities.totalKewajiban)}</Text>
          <Text className="text-[10px] text-muted-foreground">Hutang PO, PPN Keluaran & Reimburse</Text>
        </View>

        <View className="bg-card border-border/80 rounded-xl border p-3.5 gap-1">
          <Text className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Total Ekuitas (Modal)</Text>
          <Text className="text-base font-extrabold text-success">{rupiah(fin.balanceSheet.equity.totalEkuitas)}</Text>
          <Text className="text-[10px] text-muted-foreground">Modal Kerja + Laba Berjalan</Text>
        </View>

        <View className="bg-card border-border/80 rounded-xl border p-3.5 gap-1">
          <Text className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Keseimbangan (Balance)</Text>
          <View className="flex-row items-center gap-1.5 mt-0.5">
            {fin.isJournalBalanced ? (
              <>
                <CheckCircle2 size={16} color={colors.success} />
                <Text className="text-sm font-bold text-success">SEIMBANG (100%)</Text>
              </>
            ) : (
              <>
                <AlertCircle size={16} color={colors.danger} />
                <Text className="text-sm font-bold text-danger">SELISIH</Text>
              </>
            )}
          </View>
          <Text className="text-[10px] text-muted-foreground">Debit ({rupiah(fin.totalDebit)}) = Kredit</Text>
        </View>
      </View>

      {/* Tabs Switcher */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="w-full">
        <View className="flex-row items-center gap-2 pb-1">
          {[
            { id: "journal" as const, label: "Buku Jurnal Umum", icon: BookOpen, count: fin.journalLines.length },
            { id: "coa" as const, label: "Bagan Akun (COA)", icon: Scale, count: fin.coaBalances.length },
            { id: "ledger" as const, label: "Buku Besar per Akun", icon: Filter, count: ledgerLines.length },
            { id: "summary" as const, label: "Ikhtisar Keuangan & Laba Rugi", icon: TrendingUp },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setActiveTab(t.id)}
                className={
                  active
                    ? "bg-primary border-primary flex-row items-center gap-2 rounded-xl border px-4 py-2.5 shadow-sm"
                    : "bg-card border-border flex-row items-center gap-2 rounded-xl border px-4 py-2.5"
                }
              >
                <Icon size={16} color={active ? colors.background : colors.textSecondary} />
                <Text className={active ? "text-primary-foreground text-xs font-bold" : "text-text text-xs font-medium"}>
                  {t.label}
                </Text>
                {t.count !== undefined ? (
                  <View
                    className={
                      active
                        ? "bg-primary-foreground/20 rounded-full px-2 py-0.2"
                        : "bg-panel rounded-full px-2 py-0.2"
                    }
                  >
                    <Text className={active ? "text-primary-foreground text-[10px] font-bold" : "text-muted-foreground text-[10px] font-semibold"}>
                      {t.count}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* TAB 1: BUKU JURNAL UMUM */}
      {activeTab === "journal" && (
        <View className="gap-4 w-full">
          <View className="bg-primary/10 border-primary/30 rounded-xl border p-4 flex-row flex-wrap items-center justify-between gap-3">
            <View className="flex-row items-center gap-3">
              <CheckCircle2 size={20} color={colors.primary} />
              <View>
                <Text className="text-sm font-bold text-foreground">
                  Buku Jurnal Umum Berpasangan (Double-Entry General Journal)
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Total Debit: {rupiah(fin.totalDebit)} · Total Kredit: {rupiah(fin.totalKredit)} · Selisih: Rp 0 (Seimbang)
                </Text>
              </View>
            </View>
            <Button size="sm" variant="outline" onPress={handleExportJournalCsv} className="gap-1.5 h-8">
              <FileSpreadsheet size={14} color={colors.success} />
              <Text className="text-xs">Download CSV Jurnal</Text>
            </Button>
          </View>

          <Panel title="Daftar Transaksi Ayat Jurnal" subtitle="Pencatatan kronologis debit dan kredit atas seluruh transaksi operasional & manual">
            <View className="gap-3">
              <View className="flex-row flex-wrap items-center justify-between gap-2">
                <View className="flex-row items-center gap-2 flex-1 min-w-[240px]">
                  <Search size={15} color={colors.textSecondary} />
                  <Input
                    value={journalQuery}
                    onChangeText={setJournalQuery}
                    placeholder="Cari nomor jurnal, referensi, kode/nama akun, uraian..."
                    className="flex-1 h-9 text-xs"
                  />
                </View>
                <View className="flex-row flex-wrap gap-1.5">
                  {[
                    "Semua",
                    "Invoice Client",
                    "Pembayaran Invoice",
                    "PO Supplier",
                    "Pelunasan PO",
                    "Pengeluaran (Expense)",
                    "Jurnal Manual",
                  ].map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setJournalSourceFilter(s)}
                      className={
                        journalSourceFilter === s
                          ? "bg-primary/20 border-primary rounded-md border px-2.5 py-1"
                          : "bg-panel border-border rounded-md border px-2.5 py-1"
                      }
                    >
                      <Text
                        className={
                          journalSourceFilter === s
                            ? "text-primary text-xs font-semibold"
                            : "text-muted-foreground text-xs"
                        }
                      >
                        {s}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View className="min-w-[960px] w-full gap-0.5">
                  <View className="bg-panel border-border flex-row items-center border-b px-3 py-2.5 rounded-t-lg">
                    <Text className="w-[85px] text-xs font-bold">No. Jurnal</Text>
                    <Text className="w-[90px] text-xs font-bold">Tanggal</Text>
                    <Text className="w-[125px] text-xs font-bold">Referensi</Text>
                    <Text className="w-[75px] text-xs font-bold">Akun</Text>
                    <Text className="w-[220px] text-xs font-bold">Nama Akun</Text>
                    <Text className="flex-1 text-xs font-bold">Uraian Transaksi</Text>
                    <Text className="w-[125px] text-xs font-bold text-right">Debit (Rp)</Text>
                    <Text className="w-[125px] text-xs font-bold text-right">Kredit (Rp)</Text>
                  </View>
                  {filteredJournal.length === 0 ? (
                    <View className="py-12 items-center justify-center">
                      <Text className="text-xs text-muted-foreground">Tidak ada baris jurnal yang sesuai filter.</Text>
                    </View>
                  ) : (
                    filteredJournal.map((line) => {
                      const isCredit = line.kredit > 0 && line.debit === 0;
                      return (
                        <View
                          key={line.id}
                          className="border-border/50 flex-row items-center border-b px-3 py-2 hover:bg-panel/40"
                        >
                          <Text className="w-[85px] text-xs font-mono text-muted-foreground">
                            {line.journalNo}
                          </Text>
                          <Text className="w-[90px] text-xs font-mono text-muted-foreground">
                            {line.tanggal}
                          </Text>
                          <Text className="w-[125px] text-xs font-semibold font-mono" numberOfLines={1}>
                            {line.refNo}
                          </Text>
                          <Pressable
                            onPress={() => {
                              setSelectedLedgerCode(line.kodeAkun);
                              setActiveTab("ledger");
                            }}
                            className="w-[75px]"
                          >
                            <Text className="text-xs font-bold font-mono text-primary underline">
                              {line.kodeAkun}
                            </Text>
                          </Pressable>
                          <Text
                            className={`w-[220px] text-xs font-medium ${isCredit ? "pl-4 text-muted-foreground" : "text-foreground"}`}
                            numberOfLines={1}
                          >
                            {line.namaAkun}
                          </Text>
                          <Text className="flex-1 text-xs text-muted-foreground pr-3" numberOfLines={1}>
                            {line.keterangan}
                          </Text>
                          <Text className="w-[125px] text-xs font-mono text-right font-semibold">
                            {line.debit > 0 ? rupiah(line.debit) : "-"}
                          </Text>
                          <Text className="w-[125px] text-xs font-mono text-right font-semibold text-info">
                            {line.kredit > 0 ? rupiah(line.kredit) : "-"}
                          </Text>
                        </View>
                      );
                    })
                  )}
                </View>
              </ScrollView>
            </View>
          </Panel>
        </View>
      )}

      {/* TAB 2: BAGAN AKUN (COA) & NERACA SALDO */}
      {activeTab === "coa" && (
        <View className="gap-4 w-full">
          <Panel
            title="Bagan Akun Standar & Saldo (Chart of Accounts / COA)"
            subtitle="Daftar master akun akuntansi resmi PT Ghina Multi Prima beserta mutasi dan saldo akhir"
            right={
              <Button size="sm" onPress={() => setCoaModalOpen(true)} className="gap-1.5 h-8">
                <Plus size={14} color={colors.background} />
                <Text className="text-xs font-semibold">+ Tambah Akun</Text>
              </Button>
            }
          >
            <View className="gap-3">
              <View className="flex-row flex-wrap items-center justify-between gap-2">
                <View className="flex-row items-center gap-2 flex-1 min-w-[240px]">
                  <Search size={15} color={colors.textSecondary} />
                  <Input
                    value={coaQuery}
                    onChangeText={setCoaQuery}
                    placeholder="Cari kode akun atau nama akun..."
                    className="flex-1 h-9 text-xs"
                  />
                </View>
                <View className="flex-row flex-wrap gap-1.5">
                  {["Semua", ...COA_CATEGORIES].map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setCoaCategoryFilter(cat)}
                      className={
                        coaCategoryFilter === cat
                          ? "bg-primary/20 border-primary rounded-md border px-2.5 py-1"
                          : "bg-panel border-border rounded-md border px-2.5 py-1"
                      }
                    >
                      <Text
                        className={
                          coaCategoryFilter === cat
                            ? "text-primary text-xs font-semibold"
                            : "text-muted-foreground text-xs"
                        }
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View className="min-w-[880px] w-full gap-1">
                  <View className="bg-panel border-border flex-row items-center border-b px-3 py-2.5 rounded-t-lg">
                    <Text className="w-[85px] text-xs font-bold">Kode</Text>
                    <Text className="flex-1 text-xs font-bold">Nama Akun (COA)</Text>
                    <Text className="w-[170px] text-xs font-bold">Kategori Pos</Text>
                    <Text className="w-[95px] text-xs font-bold text-center">Saldo Normal</Text>
                    <Text className="w-[130px] text-xs font-bold text-right">Mutasi Debit</Text>
                    <Text className="w-[130px] text-xs font-bold text-right">Mutasi Kredit</Text>
                    <Text className="w-[140px] text-xs font-bold text-right">Saldo Akhir</Text>
                    <Text className="w-[80px] text-xs font-bold text-center">Aksi</Text>
                  </View>
                  {filteredCoa.map((acc) => (
                    <View
                      key={acc.code}
                      className="border-border/60 flex-row items-center border-b px-3 py-2 hover:bg-panel/40"
                    >
                      <Text className="w-[85px] text-xs font-bold font-mono text-primary">
                        {acc.code}
                      </Text>
                      <Text className="flex-1 text-xs font-medium text-foreground">{acc.name}</Text>
                      <Text className="w-[170px] text-xs text-muted-foreground">{acc.category}</Text>
                      <View className="w-[95px] items-center">
                        <View
                          className={`rounded-full px-2 py-0.5 border ${
                            acc.normalBalance === "DEBIT"
                              ? "bg-blue-500/10 border-blue-500/30 text-blue-600"
                              : "bg-amber-500/10 border-amber-500/30 text-amber-600"
                          }`}
                        >
                          <Text className="text-[10px] font-bold">{acc.normalBalance}</Text>
                        </View>
                      </View>
                      <Text className="w-[130px] text-xs font-mono text-right">
                        {rupiah(acc.totalDebit)}
                      </Text>
                      <Text className="w-[130px] text-xs font-mono text-right">
                        {rupiah(acc.totalKredit)}
                      </Text>
                      <Text className="w-[140px] text-xs font-bold font-mono text-right text-primary">
                        {rupiah(acc.endingBalance)}
                      </Text>
                      <View className="w-[80px] items-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onPress={() => {
                            setSelectedLedgerCode(acc.code);
                            setActiveTab("ledger");
                          }}
                          className="h-7 px-2"
                        >
                          <ArrowRight size={13} color={colors.primary} />
                        </Button>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          </Panel>
        </View>
      )}

      {/* TAB 3: BUKU BESAR PEMBANTU (LEDGER PER AKUN) */}
      {activeTab === "ledger" && (
        <View className="gap-4 w-full">
          <Panel
            title={`Buku Besar (General Ledger): [${selectedAcc?.code}] ${selectedAcc?.name}`}
            subtitle={`Kategori: ${selectedAcc?.category} · Saldo Normal: ${selectedAcc?.normalBalance} · Total ${ledgerLines.length} Mutasi Transaksi`}
            right={
              <View className="w-72">
                <SearchableSelect
                  value={selectedLedgerCode ? `[${selectedLedgerCode}] ${selectedAcc?.name}` : ""}
                  options={fin.coaBalances.map((a) => `[${a.code}] ${a.name}`)}
                  onChange={(val) => {
                    const m = val.match(/\[(\w+)\]/);
                    if (m && m[1]) setSelectedLedgerCode(m[1]);
                  }}
                  placeholder="Pilih Akun Buku Besar..."
                />
              </View>
            }
          >
            <View className="gap-3">
              {/* Account Quick Card */}
              <View className="bg-panel border-border rounded-xl border p-4 flex-row flex-wrap justify-between items-center gap-3">
                <View className="gap-0.5">
                  <Text className="text-sm font-bold text-foreground">
                    [{selectedAcc?.code}] {selectedAcc?.name}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Kelompok: {selectedAcc?.category} · Saldo Normal: {selectedAcc?.normalBalance}
                  </Text>
                </View>
                <View className="flex-row items-center gap-4">
                  <View className="text-right items-end">
                    <Text className="text-[10px] text-muted-foreground uppercase font-semibold">Total Mutasi Debit</Text>
                    <Text className="text-xs font-bold font-mono">
                      {rupiah(ledgerLines.reduce((s, l) => s + l.debit, 0))}
                    </Text>
                  </View>
                  <View className="text-right items-end">
                    <Text className="text-[10px] text-muted-foreground uppercase font-semibold">Total Mutasi Kredit</Text>
                    <Text className="text-xs font-bold font-mono text-info">
                      {rupiah(ledgerLines.reduce((s, l) => s + l.kredit, 0))}
                    </Text>
                  </View>
                  <View className="bg-primary/10 border-primary/30 border rounded-lg px-3 py-1.5 items-end">
                    <Text className="text-[10px] text-primary uppercase font-bold">Saldo Akhir Berjalan</Text>
                    <Text className="text-sm font-black font-mono text-primary">
                      {rupiah(ledgerLines.length > 0 ? (ledgerLines[ledgerLines.length - 1]?.runningBalance ?? 0) : 0)}
                    </Text>
                  </View>
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View className="min-w-[920px] w-full gap-0.5">
                  <View className="bg-panel border-border flex-row items-center border-b px-3 py-2.5 rounded-t-lg">
                    <Text className="w-[85px] text-xs font-bold">No. Jurnal</Text>
                    <Text className="w-[90px] text-xs font-bold">Tanggal</Text>
                    <Text className="w-[125px] text-xs font-bold">Referensi</Text>
                    <Text className="w-[130px] text-xs font-bold">Sumber Transaksi</Text>
                    <Text className="flex-1 text-xs font-bold">Uraian / Keterangan</Text>
                    <Text className="w-[115px] text-xs font-bold text-right">Debit (Rp)</Text>
                    <Text className="w-[115px] text-xs font-bold text-right">Kredit (Rp)</Text>
                    <Text className="w-[130px] text-xs font-bold text-right">Saldo Berjalan</Text>
                  </View>
                  {ledgerLines.length === 0 ? (
                    <View className="py-12 items-center justify-center">
                      <Text className="text-xs text-muted-foreground">
                        Belum ada mutasi pembukuan pada akun [{selectedAcc?.code}] {selectedAcc?.name}.
                      </Text>
                    </View>
                  ) : (
                    ledgerLines.map((l) => (
                      <View
                        key={l.id}
                        className="border-border/50 flex-row items-center border-b px-3 py-2 hover:bg-panel/40"
                      >
                        <Text className="w-[85px] text-xs font-mono text-muted-foreground">
                          {l.journalNo}
                        </Text>
                        <Text className="w-[90px] text-xs font-mono text-muted-foreground">
                          {l.tanggal}
                        </Text>
                        <Text className="w-[125px] text-xs font-semibold font-mono" numberOfLines={1}>
                          {l.refNo}
                        </Text>
                        <Text className="w-[130px] text-xs text-muted-foreground" numberOfLines={1}>
                          {l.sumber}
                        </Text>
                        <Text className="flex-1 text-xs text-foreground pr-3" numberOfLines={1}>
                          {l.keterangan}
                        </Text>
                        <Text className="w-[115px] text-xs font-mono text-right font-semibold">
                          {l.debit > 0 ? rupiah(l.debit) : "-"}
                        </Text>
                        <Text className="w-[115px] text-xs font-mono text-right font-semibold text-info">
                          {l.kredit > 0 ? rupiah(l.kredit) : "-"}
                        </Text>
                        <Text className="w-[130px] text-xs font-bold font-mono text-right text-primary">
                          {rupiah(l.runningBalance)}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </ScrollView>
            </View>
          </Panel>
        </View>
      )}

      {/* TAB 4: IKHTISAR KEUANGAN & NERACA */}
      {activeTab === "summary" && (
        <View className="gap-5 w-full">
          <View className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Laba Rugi Mini Card */}
            <Panel
              title="Laporan Laba Rugi Operasional (P&L)"
              subtitle="Kinerja pendapatan DPP penjualan terhadap beban pokok dan biaya operasional"
              right={
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => router.push("/reports?tab=pnl")}
                  className="gap-1.5 h-8"
                >
                  <Text className="text-xs">Buka Laporan P&L</Text>
                  <ArrowRight size={13} color={colors.primary} />
                </Button>
              }
            >
              <View className="gap-2">
                <View className="flex-row justify-between py-1 border-b border-border/40">
                  <Text className="text-xs text-muted-foreground">Pendapatan Proyek (DPP Bersih):</Text>
                  <Text className="text-xs font-bold text-foreground">{rupiah(fin.incomeStatement.revenueDpp)}</Text>
                </View>
                <View className="flex-row justify-between py-1 border-b border-border/40">
                  <Text className="text-xs text-muted-foreground">Beban Pokok Pengadaan (HPP):</Text>
                  <Text className="text-xs font-semibold text-danger">- {rupiah(fin.incomeStatement.cogsTotal)}</Text>
                </View>
                <View className="flex-row justify-between py-1 border-b border-border/40">
                  <Text className="text-xs font-bold text-foreground">Laba Kotor (Gross Profit):</Text>
                  <Text className="text-xs font-bold text-success">{rupiah(fin.incomeStatement.grossProfit)} ({fin.incomeStatement.grossMarginPct}%)</Text>
                </View>
                <View className="flex-row justify-between py-1 border-b border-border/40">
                  <Text className="text-xs text-muted-foreground">Beban Operasional & Lapangan (OPEX):</Text>
                  <Text className="text-xs font-semibold text-danger">- {rupiah(fin.incomeStatement.opexTotal)}</Text>
                </View>
                <View className="flex-row justify-between pt-2 border-t border-border">
                  <Text className="text-sm font-extrabold text-foreground">Laba Bersih Operasional (Net Profit):</Text>
                  <Text className="text-sm font-extrabold text-primary">{rupiah(fin.incomeStatement.netProfit)} ({fin.incomeStatement.netMarginPct}%)</Text>
                </View>
              </View>
            </Panel>

            {/* Neraca Mini Card */}
            <Panel
              title="Posisi Keuangan & Neraca (Balance Sheet)"
              subtitle="Struktur aktiva lancar terhadap kewajiban jangka pendek dan ekuitas modal"
              right={
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => router.push("/reports?tab=balance-sheet")}
                  className="gap-1.5 h-8"
                >
                  <Text className="text-xs">Buka Neraca Lengkap</Text>
                  <ArrowRight size={13} color={colors.primary} />
                </Button>
              }
            >
              <View className="gap-2">
                <View className="flex-row justify-between py-1 border-b border-border/40">
                  <Text className="text-xs text-muted-foreground">Total Aset Lancar (Kas, Piutang, Stok, PPh):</Text>
                  <Text className="text-xs font-bold text-foreground">{rupiah(fin.balanceSheet.assets.totalAsetLancar)}</Text>
                </View>
                <View className="flex-row justify-between py-1 border-b border-border/40">
                  <Text className="text-xs text-muted-foreground">Total Kewajiban (Hutang Supplier & PPN):</Text>
                  <Text className="text-xs font-bold text-warning">{rupiah(fin.balanceSheet.liabilities.totalKewajiban)}</Text>
                </View>
                <View className="flex-row justify-between py-1 border-b border-border/40">
                  <Text className="text-xs text-muted-foreground">Total Ekuitas (Modal Awal + Laba):</Text>
                  <Text className="text-xs font-bold text-success">{rupiah(fin.balanceSheet.equity.totalEkuitas)}</Text>
                </View>
                <View className="flex-row justify-between pt-2 border-t border-border">
                  <Text className="text-sm font-extrabold text-foreground">Total Pasiva (Kewajiban + Ekuitas):</Text>
                  <Text className="text-sm font-extrabold text-primary">{rupiah(fin.balanceSheet.totalPasiva)}</Text>
                </View>
              </View>
            </Panel>
          </View>
        </View>
      )}

      {/* MODAL: INPUT JURNAL MANUAL */}
      <Dialog open={manualModalOpen} onOpenChange={setManualModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Input Ayat Jurnal Manual (Manual Journal Entry)</DialogTitle>
          </DialogHeader>

          <ScrollView className="max-h-[60vh] gap-3 p-1">
            <View className="flex-row gap-2">
              <View className="flex-1">
                <FormField label="Tanggal Jurnal" required>
                  <DatePicker value={mjDate} onChange={setMjDate} />
                </FormField>
              </View>
              <View className="flex-1">
                <FormField label="Nomor Referensi Dokumen (Opsional)">
                  <Input value={mjRef} onChangeText={setMjRef} placeholder="Contoh: BKK-01/X/2026 atau BM-08" />
                </FormField>
              </View>
            </View>

            <FormField label="Uraian / Keterangan Transaksi" required>
              <Textarea
                value={mjDesc}
                onChangeText={setMjDesc}
                placeholder="Contoh: Setoran modal awal pemegang saham, Biaya administrasi bank, atau Penyesuaian persediaan..."
              />
            </FormField>

            {/* Dynamic Lines */}
            <View className="gap-2 border-t border-border pt-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-bold text-foreground">Rincian Baris Debit & Kredit</Text>
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() =>
                    setMjLines([
                      ...mjLines,
                      { kodeAkun: "1101", keterangan: "", debit: 0, kredit: 0 },
                    ])
                  }
                  className="h-7 px-2.5 gap-1"
                >
                  <Plus size={12} color={colors.primary} />
                  <Text className="text-[11px] font-semibold text-primary">+ Tambah Baris</Text>
                </Button>
              </View>

              {mjLines.map((line, idx) => (
                <View key={idx} className="bg-panel border-border/70 rounded-lg border p-2.5 gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[11px] font-bold text-muted-foreground">Baris #{idx + 1}</Text>
                    {mjLines.length > 2 ? (
                      <Pressable
                        onPress={() => setMjLines(mjLines.filter((_, i) => i !== idx))}
                        hitSlop={8}
                      >
                        <Trash2 size={13} color={colors.danger} />
                      </Pressable>
                    ) : null}
                  </View>

                  <SearchableSelect
                    value={`[${line.kodeAkun}] ${allAccountsMap[line.kodeAkun]?.name || line.kodeAkun}`}
                    options={Object.values(allAccountsMap).map((a) => `[${a.code}] ${a.name}`)}
                    onChange={(val) => {
                      const m = val.match(/\[(\w+)\]/);
                      if (m && m[1]) {
                        const next = [...mjLines];
                        const nextLine = next[idx];
                        if (!nextLine) return;
                        nextLine.kodeAkun = m[1];
                        setMjLines(next);
                      }
                    }}
                    placeholder="Pilih Akun..."
                  />

                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text className="text-[10px] text-muted-foreground font-semibold">Debit (Rp)</Text>
                      <Input
                        value={line.debit ? formatThousands(line.debit) : ""}
                        onChangeText={(v) => {
                          const num = Number(v.replace(/\D/g, "")) || 0;
                          const next = [...mjLines];
                          const nextLine = next[idx];
                          if (!nextLine) return;
                          nextLine.debit = num;
                          if (num > 0) nextLine.kredit = 0;
                          setMjLines(next);
                        }}
                        keyboardType="numeric"
                        placeholder="0"
                        className="h-8 text-xs font-mono"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[10px] text-muted-foreground font-semibold">Kredit (Rp)</Text>
                      <Input
                        value={line.kredit ? formatThousands(line.kredit) : ""}
                        onChangeText={(v) => {
                          const num = Number(v.replace(/\D/g, "")) || 0;
                          const next = [...mjLines];
                          const nextLine = next[idx];
                          if (!nextLine) return;
                          nextLine.kredit = num;
                          if (num > 0) nextLine.debit = 0;
                          setMjLines(next);
                        }}
                        keyboardType="numeric"
                        placeholder="0"
                        className="h-8 text-xs font-mono"
                      />
                    </View>
                  </View>
                </View>
              ))}

              {/* Total Debit vs Kredit Validation Box */}
              {(() => {
                const totD = mjLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
                const totK = mjLines.reduce((s, l) => s + (Number(l.kredit) || 0), 0);
                const isBalanced = totD > 0 && totD === totK;
                return (
                  <View
                    className={`rounded-lg border p-3 flex-row justify-between items-center ${
                      isBalanced
                        ? "bg-success/10 border-success/30 text-success"
                        : "bg-danger/10 border-danger/30 text-danger"
                    }`}
                  >
                    <View>
                      <Text className={`text-xs font-bold ${isBalanced ? "text-success" : "text-danger"}`}>
                        {isBalanced ? "Status: SEIMBANG (DEBIT = KREDIT)" : "Status: BELUM SEIMBANG"}
                      </Text>
                      <Text className="text-[11px] text-muted-foreground">
                        Total Debit: {rupiah(totD)} · Total Kredit: {rupiah(totK)}
                      </Text>
                    </View>
                    <Text className={`text-sm font-black font-mono ${isBalanced ? "text-success" : "text-danger"}`}>
                      {rupiah(Math.abs(totD - totK))} {isBalanced ? "✓" : "Selisih"}
                    </Text>
                  </View>
                );
              })()}
            </View>
          </ScrollView>

          <DialogFooter className="flex-row justify-between gap-2">
            <Button variant="outline" onPress={() => setManualModalOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveManualJournal}>
              <Text>Simpan Jurnal Manual</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: TAMBAH AKUN COA BARU */}
      <Dialog open={coaModalOpen} onOpenChange={setCoaModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Akun Baru ke COA</DialogTitle>
          </DialogHeader>

          <View className="gap-3 p-1">
            <FormField label="Kode Akun" required>
              <Input
                value={newAccCode}
                onChangeText={setNewAccCode}
                placeholder="Contoh: 1106, 2105, 6102"
                keyboardType="numeric"
              />
            </FormField>

            <FormField label="Nama Akun" required>
              <Input
                value={newAccName}
                onChangeText={setNewAccName}
                placeholder="Contoh: Bank BCA Operasional, Beban Pemeliharaan Server"
              />
            </FormField>

            <FormField label="Kategori Pos" required>
              <View className="flex-row flex-wrap gap-1.5">
                {COA_CATEGORIES.map((cat) => (
                  <Button
                    key={cat}
                    size="sm"
                    variant={newAccCategory === cat ? "default" : "outline"}
                    onPress={() => {
                      setNewAccCategory(cat);
                      if (cat === "Aset Lancar" || cat === "Beban Pokok (HPP)" || cat === "Beban Operasional") {
                        setNewAccNormalBalance("DEBIT");
                      } else {
                        setNewAccNormalBalance("KREDIT");
                      }
                    }}
                    className="h-8 px-2.5"
                  >
                    <Text className="text-xs">{cat}</Text>
                  </Button>
                ))}
              </View>
            </FormField>

            <FormField label="Saldo Normal" required>
              <View className="flex-row gap-2">
                {(["DEBIT", "KREDIT"] as const).map((bal) => (
                  <Button
                    key={bal}
                    size="sm"
                    variant={newAccNormalBalance === bal ? "default" : "outline"}
                    onPress={() => setNewAccNormalBalance(bal)}
                    className="flex-1 h-8"
                  >
                    <Text className="text-xs">{bal}</Text>
                  </Button>
                ))}
              </View>
            </FormField>
          </View>

          <DialogFooter className="flex-row justify-between gap-2">
            <Button variant="outline" onPress={() => setCoaModalOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveCustomAccount}>
              <Text>Simpan Akun</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}

