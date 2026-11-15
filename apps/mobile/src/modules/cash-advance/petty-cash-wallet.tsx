import * as React from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowDownLeft, ArrowUpRight, Receipt } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/taska/basics";
import { DatePicker, ProjectSelect, SearchableSelect } from "@/components/taska/dialogs";
import { UserSelect } from "@/components/taska/document-select";
import { FileUploader } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { colors } from "@/tokens";
import { formatThousands, rupiah, tanggal } from "@/lib/format";
import { AccountSelect, useCashAccounts } from "./cash-advance-dialogs";

/**
 * Petty cash sebagai saldo per karyawan (seperti dompet digital internal):
 *   Finance mengisi saldo -> karyawan memakai & mencatat pemakaian + foto nota -> Finance memverifikasi.
 */

export type PettyWallet = {
  employee: { id: number; name: string; role: string };
  balance: number;
  pendingReport: number;
  pendingSpend: number;
  activeCount: number;
  available: number;
};

export type WalletEntry = {
  key: string;
  date: string | null;
  kind: "ISI" | "TUGAS" | "PAKAI" | "TARIK";
  title: string;
  amount: number;
  status: string;
  ref: string;
  href?: string;
};

const parseRp = (v: string) => Number(String(v).replace(/\D/g, "")) || 0;
const today = () => new Date().toISOString().slice(0, 10);

// ─────────────── Catat pemakaian (semua karyawan) ───────────────

export function SpendPettyCashDialog({
  open,
  onOpenChange,
  available,
  defaultProject,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  available: number;
  defaultProject?: { id: string; name: string } | null;
  onSaved?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <SpendInner available={available} defaultProject={defaultProject} onClose={() => onOpenChange(false)} onSaved={onSaved} />
      ) : null}
    </Dialog>
  );
}

function SpendInner({
  available,
  defaultProject,
  onClose,
  onSaved,
}: {
  available: number;
  defaultProject?: { id: string; name: string } | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { toast, data } = useApp();
  const categories: any[] = (data as any).expenseCategories ?? [];
  const [date, setDate] = React.useState(today());
  const [desc, setDesc] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [project, setProject] = React.useState<{ id: string; name: string } | null>(defaultProject ?? null);
  const [files, setFiles] = React.useState<number[]>([]);
  const [saving, setSaving] = React.useState(false);
  const amt = parseRp(amount);
  const over = amt > available;

  async function save() {
    if (!desc.trim() || amt <= 0) return toast("Isi keperluan dan nominal", "danger");
    if (over) return toast(`Saldo petty cash tersedia hanya ${rupiah(available)}`, "danger");
    if (files.length === 0) return toast("Foto nota / struk wajib dilampirkan", "danger");
    setSaving(true);
    try {
      const cat = categories.find((c: any) => String(c.nama || c.name) === category);
      await api("POST", "/expenses", {
        date,
        description: desc.trim(),
        amount: amt,
        categoryId: cat ? Number(cat.id) : undefined,
        projectId: project ? Number(project.id) : undefined,
        fundingSource: "PETTY_CASH",
        receiptFileId: files[0],
        receiptFileIds: files.join(","),
      });
      toast(`Pemakaian ${rupiah(amt)} dicatat. Menunggu verifikasi Finance.`);
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mencatat pemakaian", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="w-[94vw] max-w-md">
      <DialogHeader>
        <DialogTitle>Catat Pemakaian Petty Cash</DialogTitle>
      </DialogHeader>
      <View className="gap-3 py-1">
        <View className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
          <Text className="text-xs text-muted-foreground">
            Saldo tersedia <Text className="text-xs font-bold text-primary">{rupiah(available)}</Text>
          </Text>
        </View>
        <FormField label="Untuk apa?" required>
          <Input value={desc} onChangeText={setDesc} placeholder="Contoh: Bensin & tol ke lokasi customer" />
        </FormField>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <FormField label="Nominal (Rp)" required>
              <Input value={amount} onChangeText={(v) => setAmount(formatThousands(v))} keyboardType="numeric" placeholder="0" />
            </FormField>
          </View>
          <View className="flex-1">
            <FormField label="Tanggal">
              <DatePicker value={date} onChange={setDate} />
            </FormField>
          </View>
        </View>
        {over ? <Text className="text-xs text-destructive">Melebihi saldo tersedia ({rupiah(available)}).</Text> : null}
        {categories.length > 0 ? (
          <FormField label="Kategori">
            <SearchableSelect value={category} options={categories.map((c: any) => String(c.nama || c.name))} onChange={setCategory} placeholder="Pilih kategori" />
          </FormField>
        ) : null}
        <FormField label="Proyek (opsional)" hint="Isi bila biaya ini untuk proyek tertentu — masuk ke laba-rugi proyek">
          <ProjectSelect
            value={project?.name}
            projectId={project?.id}
            onChange={(p) => setProject(p ? { id: String(p.id), name: String(p.nama || p.name || "-") } : null)}
          />
        </FormField>
        <FormField label="Foto nota / struk" required>
          <FileUploader label="Foto nota" kind="semua" category="petty-cash" multiple autoFlush onUploaded={(fid) => setFiles((p) => [...p, fid])} />
        </FormField>
      </View>
      <DialogFooter className="flex-row gap-2">
        <Button variant="outline" onPress={onClose} disabled={saving}>
          <Text>Batal</Text>
        </Button>
        <Button onPress={save} disabled={saving || over}>
          <Text className="text-white font-semibold">{saving ? "Menyimpan..." : "Simpan"}</Text>
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─────────────── Isi / tarik saldo (Finance) ───────────────

export function TopUpPettyCashDialog({
  mode,
  employee,
  available,
  onOpenChange,
  onSaved,
}: {
  /** null = tertutup */
  mode: "isi" | "tarik" | null;
  employee?: { id: number; name: string } | null;
  available?: number;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}) {
  return (
    <Dialog open={!!mode} onOpenChange={onOpenChange}>
      {mode ? (
        <TopUpInner mode={mode} employee={employee} available={available} onClose={() => onOpenChange(false)} onSaved={onSaved} />
      ) : null}
    </Dialog>
  );
}

function TopUpInner({
  mode,
  employee: initialEmployee,
  available,
  onClose,
  onSaved,
}: {
  mode: "isi" | "tarik";
  employee?: { id: number; name: string } | null;
  available?: number;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { toast } = useApp();
  const accounts = useCashAccounts();
  const [employee, setEmployee] = React.useState<{ id: string; name: string } | null>(
    initialEmployee ? { id: String(initialEmployee.id), name: initialEmployee.name } : null,
  );
  const [amount, setAmount] = React.useState("");
  const [account, setAccount] = React.useState("");
  const [date, setDate] = React.useState(today());
  const [desc, setDesc] = React.useState("");
  const [fileId, setFileId] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);
  const isTopUp = mode === "isi";

  async function save() {
    const amt = parseRp(amount);
    if (!employee) return toast("Pilih karyawan", "danger");
    if (amt <= 0) return toast("Isi nominal", "danger");
    if (!account) return toast(isTopUp ? "Pilih akun kas / bank sumber dana" : "Pilih akun kas / bank tujuan", "danger");
    if (!isTopUp && available != null && amt > available) return toast(`Saldo tersedia hanya ${rupiah(available)}`, "danger");
    setSaving(true);
    try {
      await api("POST", `/cash-advances/${isTopUp ? "topup" : "withdraw"}`, {
        employeeId: Number(employee.id),
        amount: amt,
        accountCode: account,
        date,
        description: desc.trim() || undefined,
        fileId: fileId ?? undefined,
      });
      toast(isTopUp ? `Saldo petty cash ${employee.name} bertambah ${rupiah(amt)}` : `Rp ${amt.toLocaleString("id-ID")} dikembalikan ke kas`);
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyimpan", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="w-[94vw] max-w-md">
      <DialogHeader>
        <DialogTitle>{isTopUp ? "Isi Saldo Petty Cash" : "Tarik Saldo Petty Cash"}</DialogTitle>
      </DialogHeader>
      <View className="gap-3 py-1">
        <Text className="text-xs text-muted-foreground">
          {isTopUp
            ? "Uang diberikan langsung ke karyawan. Karyawan mencatat setiap pemakaian + foto nota, lalu Finance memverifikasi."
            : "Sisa uang petty cash yang dikembalikan karyawan ke kas perusahaan."}
        </Text>
        <FormField label="Karyawan" required>
          <UserSelect
            value={employee?.name}
            userId={employee?.id}
            onChange={(u) => setEmployee(u ? { id: String(u.id), name: String(u.nama || u.name || "-") } : null)}
            allowClear={false}
          />
        </FormField>
        {!isTopUp && available != null ? (
          <Text className="text-xs text-muted-foreground">
            Saldo tersedia <Text className="text-xs font-semibold text-foreground">{rupiah(available)}</Text>
          </Text>
        ) : null}
        <View className="flex-row gap-2">
          <View className="flex-1">
            <FormField label="Nominal (Rp)" required>
              <Input value={amount} onChangeText={(v) => setAmount(formatThousands(v))} keyboardType="numeric" placeholder="0" />
            </FormField>
          </View>
          <View className="flex-1">
            <FormField label="Tanggal">
              <DatePicker value={date} onChange={setDate} />
            </FormField>
          </View>
        </View>
        <FormField label={isTopUp ? "Dari akun kas / bank" : "Masuk ke akun kas / bank"} required>
          <AccountSelect value={account} onChange={setAccount} accounts={accounts} />
        </FormField>
        <FormField label="Keterangan (opsional)">
          <Input value={desc} onChangeText={setDesc} placeholder={isTopUp ? "Contoh: Petty cash bulanan November" : "Contoh: Sisa petty cash dikembalikan"} />
        </FormField>
        <FormField label="Bukti transfer / serah terima (opsional)">
          <FileUploader label="Pilih foto / PDF" kind="semua" category="petty-cash" autoFlush onUploaded={(fid) => setFileId(fid)} />
        </FormField>
      </View>
      <DialogFooter className="flex-row gap-2">
        <Button variant="outline" onPress={onClose} disabled={saving}>
          <Text>Batal</Text>
        </Button>
        <Button onPress={save} disabled={saving}>
          <Text className="text-white font-semibold">{saving ? "Menyimpan..." : isTopUp ? "Isi Saldo" : "Tarik Saldo"}</Text>
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─────────────── Mutasi saldo ───────────────

export function useWalletHistory(employeeId?: number | null, version = 0) {
  const [state, setState] = React.useState<{ wallet: PettyWallet | null; entries: WalletEntry[]; loading: boolean }>({
    wallet: null,
    entries: [],
    loading: true,
  });
  React.useEffect(() => {
    let alive = true;
    api<{ wallet: PettyWallet | null; entries: WalletEntry[] }>(
      "GET",
      `/cash-advances/wallet/history${employeeId ? `?employeeId=${employeeId}` : ""}`,
    )
      .then((res) => {
        if (alive) setState({ wallet: res?.wallet ?? null, entries: res?.entries ?? [], loading: false });
      })
      .catch(() => alive && setState((s) => ({ ...s, loading: false })));
    return () => {
      alive = false;
    };
  }, [employeeId, version]);
  return state;
}

export function WalletEntries({ entries, limit }: { entries: WalletEntry[]; limit?: number }) {
  const router = useRouter();
  const shown = limit ? entries.slice(0, limit) : entries;
  if (!shown.length) return <Text className="text-xs text-muted-foreground py-2">Belum ada mutasi.</Text>;
  return (
    <View>
      {shown.map((e, i) => {
        const plus = e.amount > 0;
        const Icon = e.kind === "PAKAI" ? Receipt : plus ? ArrowDownLeft : ArrowUpRight;
        return (
          <Pressable
            key={e.key}
            disabled={!e.href}
            onPress={e.href ? () => router.push(e.href as any) : undefined}
            className={`flex-row items-center gap-3 py-2.5 ${i > 0 ? "border-t border-border/60" : ""}`}
          >
            <View className={`size-8 rounded-full items-center justify-center ${plus ? "bg-emerald-500/10" : "bg-muted"}`}>
              <Icon size={15} color={plus ? "#10b981" : colors.muted} />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-sm text-foreground" numberOfLines={1}>
                {e.title}
              </Text>
              <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                {e.date ? tanggal(e.date) : "-"} · {e.ref} · {e.status}
              </Text>
            </View>
            <Text className={`text-sm font-semibold ${plus ? "text-emerald-600" : "text-foreground"}`}>
              {plus ? "+" : "−"}
              {rupiah(Math.abs(e.amount))}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function WalletHistoryDialog({
  employee,
  onOpenChange,
}: {
  employee: { id: number; name: string } | null;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={!!employee} onOpenChange={onOpenChange}>
      {employee ? <HistoryInner employee={employee} /> : null}
    </Dialog>
  );
}

function HistoryInner({ employee }: { employee: { id: number; name: string } }) {
  const { wallet, entries, loading } = useWalletHistory(employee.id);
  return (
    <DialogContent className="w-[94vw] max-w-lg">
      <DialogHeader>
        <DialogTitle>Mutasi Petty Cash — {employee.name}</DialogTitle>
      </DialogHeader>
      <View className="gap-2 py-1">
        <Text className="text-xs text-muted-foreground">
          Saldo {rupiah(wallet?.balance ?? 0)} · tersedia{" "}
          <Text className="text-xs font-semibold text-foreground">{rupiah(wallet?.available ?? 0)}</Text>
        </Text>
        {loading ? <Text className="text-xs text-muted-foreground">Memuat...</Text> : <WalletEntries entries={entries} />}
      </View>
    </DialogContent>
  );
}
