import * as React from "react";
import { View, Pressable } from "react-native";
import { HandCoins, Plus, Send, Wallet } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/taska/basics";
import { DatePicker, SearchableSelect } from "@/components/taska/dialogs";
import { FileUploader } from "@/components/taska/file-uploader";
import { StatusBadge } from "@/components/taska/status-badge";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { colors } from "@/tokens";
import { formatThousands, rupiah, tanggal } from "@/lib/format";
import {
  CashAdvanceDetailDialog,
  CreateCashAdvanceDialog,
  STATUS_LABEL,
  useIsFinance,
  type CashAdvance,
} from "./cash-advance-dialogs";

const today = () => new Date().toISOString().slice(0, 10);
const isOpen = (r: CashAdvance) => r.status === "DICAIRKAN" || r.status === "DILAPORKAN";
const isWaiting = (r: CashAdvance) => r.status === "DIAJUKAN" || r.status === "DISETUJUI";

/**
 * Kantong kas proyek di halaman detail project: lihat saldo, catat pengeluaran langsung dari kantong,
 * ajukan kas / top-up, dan kirim laporan ke Finance — tanpa pindah halaman.
 */
export function ProjectWalletCard({ projectId, projectName }: { projectId: number; projectName: string }) {
  const { user } = useApp();
  const isFinance = useIsFinance();
  const [rows, setRows] = React.useState<CashAdvance[]>([]);
  const [version, setVersion] = React.useState(0);
  const reload = React.useCallback(() => setVersion((v) => v + 1), []);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [expenseOpen, setExpenseOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<number | null>(null);
  const [sending, setSending] = React.useState<number | null>(null);
  const { toast } = useApp();

  React.useEffect(() => {
    let alive = true;
    api<{ items: CashAdvance[] }>("GET", `/cash-advances?projectId=${projectId}`)
      .then((res) => {
        if (alive) setRows(res.items ?? []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [projectId, version]);

  const me = Number(user?.id);
  const mine = rows.filter((r) => r.employeeId === me);
  const myOpen = mine.filter(isOpen);
  const myWaiting = rows.filter((r) => isWaiting(r) && (r.employeeId === me || r.requestedById === me));
  const held = myOpen.reduce((s, r) => s + (r.disbursedAmount ?? 0), 0);
  const used = myOpen.reduce((s, r) => s + r.reportedTotal, 0);
  const remaining = held - used;

  // Tampilan tim (Finance / PM melihat kas proyek yang dipegang orang lain)
  const teamOpen = rows.filter((r) => isOpen(r) && r.employeeId !== me);
  const teamHeld = teamOpen.reduce((s, r) => s + (r.disbursedAmount ?? 0), 0);
  const financeQueue = isFinance ? rows.filter((r) => r.status === "DIAJUKAN" || r.status === "DISETUJUI" || r.status === "DILAPORKAN") : [];

  async function sendReport(r: CashAdvance) {
    setSending(r.id);
    try {
      await api("POST", `/cash-advances/${r.id}/report`, {});
      toast(`Laporan ${r.number} dikirim ke Finance`);
      reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengirim laporan", "danger");
    } finally {
      setSending(null);
    }
  }

  return (
    <View className="rounded-2xl border border-primary/30 bg-primary/5 p-4 gap-3">
      {/* Saldo */}
      <View className="flex-row flex-wrap items-start justify-between gap-3">
        <View className="gap-0.5 min-w-[180px]">
          <View className="flex-row items-center gap-1.5">
            <Wallet size={16} color={colors.primary} />
            <Text className="text-sm font-bold text-foreground">Kantong kas proyek saya</Text>
          </View>
          <Text className={`text-2xl font-bold ${remaining < 0 ? "text-danger" : "text-primary"}`}>{rupiah(Math.max(0, remaining))}</Text>
          <Text className="text-[11px] text-muted-foreground">
            {held > 0
              ? `Diterima ${rupiah(held)} · dipakai ${rupiah(used)}${remaining < 0 ? ` · kurang ${rupiah(-remaining)} (diganti Finance saat verifikasi)` : ""}`
              : "Belum ada kas proyek di tangan Anda."}
          </Text>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Button
            onPress={() => (myOpen.length ? setExpenseOpen(true) : toast(myWaiting.length ? "Kas proyek masih menunggu persetujuan / pencairan Finance" : "Ajukan kas proyek dulu", "info"))}
            className="flex-row items-center gap-1.5"
          >
            <Plus size={15} color="#fff" />
            <Text className="text-sm font-semibold text-white">Catat Pengeluaran</Text>
          </Button>
          <Button variant="outline" onPress={() => setCreateOpen(true)} className="flex-row items-center gap-1.5">
            <HandCoins size={15} color={colors.primary} />
            <Text className="text-sm font-semibold text-primary">{held > 0 ? "Top-up Kas" : "Ajukan Kas"}</Text>
          </Button>
        </View>
      </View>

      {/* Pengajuan yang masih menunggu */}
      {myWaiting.map((r) => (
        <Pressable key={r.id} onPress={() => setDetailId(r.id)} className="flex-row items-center justify-between gap-2 rounded-lg bg-background/70 border border-border px-3 py-2">
          <Text className="text-xs text-foreground flex-1">
            {r.number} · {rupiah(r.approvedAmount ?? r.amount)}
          </Text>
          <StatusBadge status={STATUS_LABEL[r.status]} />
        </Pressable>
      ))}

      {/* Kas yang sedang dipegang: pengeluaran terakhir + kirim laporan */}
      {myOpen.map((r) => {
        const last = r.items.slice(-3).reverse();
        return (
          <View key={r.id} className="rounded-lg bg-background/70 border border-border px-3 py-2 gap-1.5">
            <Pressable onPress={() => setDetailId(r.id)} className="flex-row items-center justify-between gap-2">
              <Text className="text-xs font-semibold text-foreground flex-1">
                {r.number} · sisa {rupiah(Math.max(0, (r.disbursedAmount ?? 0) - r.reportedTotal))} dari {rupiah(r.disbursedAmount ?? 0)}
              </Text>
              <StatusBadge status={STATUS_LABEL[r.status]} />
            </Pressable>
            {last.length === 0 ? (
              <Text className="text-[11px] text-muted-foreground">Belum ada pengeluaran dicatat.</Text>
            ) : (
              last.map((it) => (
                <View key={it.id} className="flex-row justify-between">
                  <Text className="text-[11px] text-muted-foreground flex-1" numberOfLines={1}>
                    {tanggal(it.date)} · {it.description}
                    {it.receiptFileIds.length === 0 ? " · tanpa nota" : ""}
                  </Text>
                  <Text className="text-[11px] font-semibold text-foreground">{rupiah(it.amount)}</Text>
                </View>
              ))
            )}
            {r.items.length > 3 ? (
              <Pressable onPress={() => setDetailId(r.id)}>
                <Text className="text-[11px] text-primary">Lihat semua {r.items.length} pengeluaran</Text>
              </Pressable>
            ) : null}
            {r.status === "DICAIRKAN" && r.items.length > 0 ? (
              <Button size="sm" variant="outline" disabled={sending === r.id} onPress={() => sendReport(r)} className="self-start flex-row items-center gap-1">
                <Send size={12} color={colors.text} />
                <Text className="text-xs">{sending === r.id ? "Mengirim..." : "Selesai, kirim laporan ke Finance"}</Text>
              </Button>
            ) : r.status === "DILAPORKAN" ? (
              <Text className="text-[11px] text-muted-foreground">Laporan sudah dikirim, menunggu verifikasi Finance. Pengeluaran baru masih bisa ditambahkan.</Text>
            ) : null}
          </View>
        );
      })}

      {/* Ringkasan tim / antrian Finance */}
      {teamOpen.length > 0 || financeQueue.length > 0 ? (
        <View className="gap-1 pt-1 border-t border-primary/20">
          {teamOpen.length > 0 ? (
            <Text className="text-[11px] text-muted-foreground">
              Kas proyek dipegang tim lain: <Text className="text-[11px] font-semibold text-foreground">{rupiah(teamHeld)}</Text> ({teamOpen.map((r) => r.employee.name).join(", ")})
            </Text>
          ) : null}
          {financeQueue.length > 0 ? (
            <View className="flex-row flex-wrap gap-1.5">
              {financeQueue.map((r) => (
                <Pressable key={r.id} onPress={() => setDetailId(r.id)} className="rounded-full border border-warning/50 bg-warning/10 px-2.5 py-1">
                  <Text className="text-[11px] text-foreground">
                    {r.employee.name} · {STATUS_LABEL[r.status]}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <CreateCashAdvanceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaults={{ purpose: "PROJECT", projectId, description: `Kas proyek ${projectName}`, title: held > 0 ? "Top-up Kas Proyek" : "Ajukan Kas Proyek" }}
        onCreated={reload}
      />
      <QuickExpenseDialog open={expenseOpen} onOpenChange={setExpenseOpen} advances={myOpen} onSaved={reload} />
      <CashAdvanceDetailDialog id={detailId} onOpenChange={(v) => !v && setDetailId(null)} onChanged={reload} />
    </View>
  );
}

/** Catat satu pengeluaran (nota) langsung dari kantong kas proyek. */
function QuickExpenseDialog({
  open,
  onOpenChange,
  advances,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  advances: CashAdvance[];
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <QuickExpenseInner advances={advances} onClose={() => onOpenChange(false)} onSaved={onSaved} /> : null}
    </Dialog>
  );
}

function QuickExpenseInner({ advances, onClose, onSaved }: { advances: CashAdvance[]; onClose: () => void; onSaved: () => void }) {
  const { toast, data } = useApp();
  const categories: any[] = (data as any).expenseCategories ?? [];
  const [advanceId, setAdvanceId] = React.useState<number | null>(advances[0]?.id ?? null);
  const [date, setDate] = React.useState(today());
  const [desc, setDesc] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [files, setFiles] = React.useState<number[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [addAnother, setAddAnother] = React.useState(0);
  const adv = advances.find((a) => a.id === advanceId);
  const label = (a: CashAdvance) => `${a.number} · sisa ${rupiah(Math.max(0, (a.disbursedAmount ?? 0) - a.reportedTotal))}`;

  async function save(keepOpen: boolean) {
    const amt = Number(String(amount).replace(/\D/g, "")) || 0;
    if (!advanceId) return toast("Pilih kas proyek", "danger");
    if (!desc.trim() || amt <= 0) return toast("Isi keterangan dan nominal", "danger");
    if (files.length === 0) return toast("Foto nota / struk wajib dilampirkan", "danger");
    setSaving(true);
    try {
      const cat = categories.find((c: any) => String(c.nama || c.name) === category);
      await api("POST", `/cash-advances/${advanceId}/items`, {
        date,
        description: desc.trim(),
        amount: amt,
        categoryId: cat ? Number(cat.id) : undefined,
        receiptFileIds: files,
      });
      toast(`Pengeluaran ${rupiah(amt)} dicatat dari kas proyek`);
      onSaved();
      if (keepOpen) {
        setDesc("");
        setAmount("");
        setFiles([]);
        setAddAnother((k) => k + 1);
      } else onClose();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mencatat pengeluaran", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="w-[94vw] max-w-md">
      <DialogHeader>
        <DialogTitle>Catat Pengeluaran Proyek</DialogTitle>
      </DialogHeader>
      <View className="gap-3 py-1">
        {advances.length > 1 ? (
          <FormField label="Dari kas">
            <SearchableSelect
              value={adv ? label(adv) : ""}
              options={advances.map(label)}
              onChange={(v) => setAdvanceId(advances.find((a) => label(a) === v)?.id ?? null)}
            />
          </FormField>
        ) : adv ? (
          <Text className="text-xs text-muted-foreground">
            Dari kas {adv.number} · sisa <Text className="text-xs font-semibold text-foreground">{rupiah(Math.max(0, (adv.disbursedAmount ?? 0) - adv.reportedTotal))}</Text>
          </Text>
        ) : null}
        <FormField label="Untuk apa?" required>
          <Input value={desc} onChangeText={setDesc} placeholder="Contoh: Beli kabel UTP 1 roll" />
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
        {categories.length > 0 ? (
          <FormField label="Kategori (opsional)">
            <SearchableSelect value={category} options={categories.map((c: any) => String(c.nama || c.name))} onChange={setCategory} placeholder="Pilih kategori" />
          </FormField>
        ) : null}
        <FormField label="Foto nota / struk" required>
          <FileUploader key={addAnother} label="Foto nota" kind="semua" category="uang-jalan" multiple autoFlush onUploaded={(fid) => setFiles((p) => [...p, fid])} />
        </FormField>
      </View>
      <DialogFooter className="flex-row flex-wrap gap-2">
        <Button variant="outline" onPress={() => save(true)} disabled={saving}>
          <Text>Simpan & tambah lagi</Text>
        </Button>
        <Button onPress={() => save(false)} disabled={saving}>
          <Text className="text-white font-semibold">{saving ? "Menyimpan..." : "Simpan"}</Text>
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
