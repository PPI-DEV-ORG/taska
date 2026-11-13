import * as React from "react";
import { View, Pressable, ScrollView, Linking } from "react-native";
import { Check, Plus, Trash2, Wallet, Paperclip } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/taska/basics";
import { DatePicker, ProjectSelect, SearchableSelect } from "@/components/taska/dialogs";
import { UserSelect } from "@/components/taska/document-select";
import { FileUploader } from "@/components/taska/file-uploader";
import { StatusBadge } from "@/components/taska/status-badge";
import { useApp } from "@/store/app-store";
import { api, apiBase } from "@/services/api";
import { colors } from "@/tokens";
import { formatThousands, rupiah, tanggal } from "@/lib/format";

// ─────────────── Tipe & label ───────────────

export type CashAdvancePurpose = "SURVEY" | "PENGIRIMAN" | "PROJECT" | "LAINNYA";
export type CashAdvanceStatus = "DIAJUKAN" | "DISETUJUI" | "DITOLAK" | "DICAIRKAN" | "DILAPORKAN" | "SELESAI" | "DIBATALKAN";

export type CashAdvance = {
  id: number;
  number: string;
  purpose: CashAdvancePurpose;
  description: string;
  status: CashAdvanceStatus;
  amount: number;
  approvedAmount: number | null;
  disbursedAmount: number | null;
  disbursedAt: string | null;
  disburseAccountCode: string | null;
  disburseMethod: string | null;
  disburseFile: { id: number; originalName: string } | null;
  returnFile: { id: number; originalName: string } | null;
  neededDate: string | null;
  rejectReason: string | null;
  reportNote: string | null;
  spentAmount: number;
  returnedAmount: number;
  reimbursedAmount: number;
  remaining: number;
  shortage: number;
  reportedTotal: number;
  employeeId: number;
  requestedById: number;
  employee: { id: number; name: string; role: string };
  requestedBy: { id: number; name: string };
  approvedBy: { id: number; name: string } | null;
  disbursedBy: { id: number; name: string } | null;
  settledBy: { id: number; name: string } | null;
  survey: { id: number; location: string; lead?: { name: string } | null } | null;
  deliveryNote: { id: number; number: string } | null;
  project: { id: number; name: string } | null;
  items: { id: number; date: string; description: string; amount: number; category?: { name: string } | null; receiptFileIds: number[] }[];
  createdAt: string;
};

export const PURPOSE_LABEL: Record<CashAdvancePurpose, string> = {
  SURVEY: "Survey",
  PENGIRIMAN: "Kirim / Ambil Barang",
  PROJECT: "Kas Proyek",
  LAINNYA: "Lainnya",
};

export const STATUS_LABEL: Record<CashAdvanceStatus, string> = {
  DIAJUKAN: "Diajukan",
  DISETUJUI: "Menunggu pencairan",
  DITOLAK: "Ditolak",
  DICAIRKAN: "Dicairkan",
  DILAPORKAN: "Dilaporkan",
  SELESAI: "Selesai",
  DIBATALKAN: "Dibatalkan",
};

const FINANCE_ROLES = ["super_admin", "admin", "bos", "finance"];
export function useIsFinance() {
  const { user } = useApp();
  return FINANCE_ROLES.includes(String(user?.role || "").toLowerCase());
}

const parseRp = (v: string) => Number(String(v).replace(/\D/g, "")) || 0;
const today = () => new Date().toISOString().slice(0, 10);

/** Akun kas / bank aktif dari server (sumber dana pencairan / tujuan pengembalian). */
function useCashAccounts() {
  const [accounts, setAccounts] = React.useState<{ code: string; name: string }[]>([]);
  React.useEffect(() => {
    let alive = true;
    api<any>("GET", "/accounting/accounts?cash=true&postable=true")
      .then((res) => {
        const list: any[] = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
        if (alive) setAccounts(list.filter((a) => (a.status ?? "AKTIF") === "AKTIF").map((a) => ({ code: String(a.code), name: String(a.name) })));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return accounts;
}

function AccountSelect({ value, onChange, accounts, placeholder }: { value: string; onChange: (code: string) => void; accounts: { code: string; name: string }[]; placeholder?: string }) {
  const label = (a: { code: string; name: string }) => `${a.name} [${a.code}]`;
  const current = accounts.find((a) => a.code === value);
  return (
    <SearchableSelect
      value={current ? label(current) : ""}
      options={accounts.map(label)}
      onChange={(v) => {
        const found = accounts.find((a) => label(a) === v);
        if (found) onChange(found.code);
      }}
      placeholder={placeholder || "Pilih akun kas / bank..."}
    />
  );
}

function ChoiceRow<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { key: T; title: string; desc?: string }[] }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            className={`flex-1 min-w-[140px] rounded-lg border px-3 py-2 ${active ? "border-primary bg-primary/10" : "border-border bg-background"}`}
          >
            <View className="flex-row items-center gap-1.5">
              {active ? <Check size={12} color={colors.primary} /> : null}
              <Text className={`text-xs font-semibold ${active ? "text-primary" : "text-foreground"}`}>{opt.title}</Text>
            </View>
            {opt.desc ? <Text className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function openFile(fileId: number) {
  const url = `${apiBase()}/files/${fileId}`;
  if (typeof window !== "undefined") window.open(url, "_blank");
  else Linking.openURL(url).catch(() => {});
}

// ─────────────── Ajukan uang jalan ───────────────

export function CreateCashAdvanceDialog({
  open,
  onOpenChange,
  defaults,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaults?: { purpose?: CashAdvancePurpose; surveyId?: number; deliveryNoteId?: number; projectId?: number; description?: string; title?: string };
  onCreated?: (row: CashAdvance) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <CreateInner onOpenChange={onOpenChange} defaults={defaults} onCreated={onCreated} /> : null}
    </Dialog>
  );
}

function CreateInner({
  onOpenChange,
  defaults,
  onCreated,
}: {
  onOpenChange: (v: boolean) => void;
  defaults?: { purpose?: CashAdvancePurpose; surveyId?: number; deliveryNoteId?: number; projectId?: number; description?: string; title?: string };
  onCreated?: (row: CashAdvance) => void;
}) {
  const { user, toast } = useApp();
  const [purpose, setPurpose] = React.useState<CashAdvancePurpose>(defaults?.purpose ?? "SURVEY");
  const [description, setDescription] = React.useState(defaults?.description ?? "");
  const [amount, setAmount] = React.useState("");
  const [neededDate, setNeededDate] = React.useState(today());
  const [employee, setEmployee] = React.useState<{ id: string; name: string } | null>(
    user ? { id: String(user.id), name: String(user.name || "Saya") } : null,
  );
  const [saving, setSaving] = React.useState(false);
  const [project, setProject] = React.useState<{ id: string; name: string } | null>(null);
  const linked = !!(defaults?.surveyId || defaults?.deliveryNoteId || defaults?.projectId);
  const needsProject = purpose === "PROJECT" && !defaults?.projectId;

  async function submit() {
    const amt = parseRp(amount);
    if (!description.trim()) return toast("Isi keperluan uang jalan", "danger");
    if (amt <= 0) return toast("Isi nominal uang jalan", "danger");
    if (!employee) return toast("Pilih karyawan yang memegang uang", "danger");
    if (needsProject && !project) return toast("Pilih project untuk kas proyek ini", "danger");
    setSaving(true);
    try {
      const row = await api<CashAdvance>("POST", "/cash-advances", {
        purpose,
        description: description.trim(),
        amount: amt,
        employeeId: Number(employee.id),
        surveyId: defaults?.surveyId,
        deliveryNoteId: defaults?.deliveryNoteId,
        projectId: defaults?.projectId ?? (project ? Number(project.id) : undefined),
        neededDate,
      });
      toast(`Uang jalan ${row.number} diajukan ke Finance`);
      onCreated?.(row);
      onOpenChange(false);
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengajukan uang jalan", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="w-[94vw] max-w-lg max-h-[92vh]">
      <DialogHeader>
        <DialogTitle>{defaults?.title || "Ajukan Uang Jalan"}</DialogTitle>
      </DialogHeader>
      <ScrollView className="max-h-[70vh]" showsVerticalScrollIndicator={false}>
        <View className="gap-3 py-1">
          {!linked ? (
            <FormField label="Untuk keperluan">
              <ChoiceRow
                value={purpose}
                onChange={setPurpose}
                options={[
                  { key: "SURVEY", title: "Survey" },
                  { key: "PENGIRIMAN", title: "Kirim / Ambil Barang" },
                  { key: "PROJECT", title: "Kas Proyek" },
                  { key: "LAINNYA", title: "Lainnya" },
                ]}
              />
            </FormField>
          ) : null}
          {needsProject ? (
            <FormField label="Project" hint="Biaya dari uang jalan ini masuk ke P&L project yang dipilih" required>
              <ProjectSelect
                value={project?.name}
                projectId={project?.id}
                onChange={(p) => setProject(p ? { id: String(p.id), name: String(p.nama || p.name || "-") } : null)}
              />
            </FormField>
          ) : null}
          <FormField label="Keperluan / rincian perkiraan biaya" required>
            <Textarea value={description} onChangeText={setDescription} placeholder="Contoh: Bensin PP Bekasi–Bogor, tol, parkir, makan 2 orang" />
          </FormField>
          <FormField label="Nominal yang diajukan (Rp)" required>
            <Input value={amount} onChangeText={(v) => setAmount(formatThousands(v))} keyboardType="numeric" placeholder="Contoh: 500.000" />
          </FormField>
          <FormField label="Uang diberikan kepada" hint="Karyawan yang berangkat (surveyor / admin gudang / kurir)" required>
            <UserSelect
              value={employee?.name}
              userId={employee?.id}
              onChange={(u) => setEmployee(u ? { id: String(u.id), name: String(u.nama || u.name || "-") } : null)}
              allowClear={false}
            />
          </FormField>
          <FormField label="Dibutuhkan tanggal">
            <DatePicker value={neededDate} onChange={setNeededDate} />
          </FormField>
          <Text className="text-[11px] text-muted-foreground">
            Setelah disetujui, Finance mencairkan uang dari akun kas/bank dan uangnya masuk ke kantong uang jalan karyawan.
            Simpan nota/struk, lalu laporkan biayanya setelah tugas selesai.
          </Text>
        </View>
      </ScrollView>
      <DialogFooter>
        <Button variant="outline" onPress={() => onOpenChange(false)} disabled={saving}>
          <Text>Batal</Text>
        </Button>
        <Button onPress={submit} disabled={saving}>
          <Text className="text-white font-semibold">{saving ? "Mengirim..." : "Ajukan ke Finance"}</Text>
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─────────────── Detail & aksi ───────────────

export function CashAdvanceDetailDialog({
  id,
  onOpenChange,
  onChanged,
}: {
  id: number | null;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
}) {
  return (
    <Dialog open={id != null} onOpenChange={onOpenChange}>
      {id != null ? <DetailInner key={id} id={id} onChanged={onChanged} onClose={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

function Row2({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <View className="flex-row justify-between items-start gap-3 py-0.5">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      {typeof value === "string" || typeof value === "number" ? (
        <Text className={`text-xs text-right flex-1 ${strong ? "font-bold text-foreground" : "text-foreground"}`}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

function DetailInner({ id, onChanged, onClose }: { id: number; onChanged?: () => void; onClose: () => void }) {
  const { user, toast, data } = useApp();
  const isFinance = useIsFinance();
  const accounts = useCashAccounts();
  const [row, setRow] = React.useState<CashAdvance | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [panel, setPanel] = React.useState<null | "approve" | "reject" | "disburse" | "item" | "settle">(null);

  React.useEffect(() => {
    let alive = true;
    api<CashAdvance>("GET", `/cash-advances/${id}`)
      .then((res) => {
        if (alive) setRow(res);
      })
      .catch((e: any) => toast(e?.message ?? "Gagal memuat uang jalan", "danger"));
    return () => {
      alive = false;
    };
  }, [id, toast]);

  async function run(fn: () => Promise<CashAdvance>, ok: string) {
    setBusy(true);
    try {
      setRow(await fn());
      setPanel(null);
      toast(ok);
      onChanged?.();
    } catch (e: any) {
      toast(e?.message ?? "Gagal memproses", "danger");
    } finally {
      setBusy(false);
    }
  }

  // form state
  const [approveAmount, setApproveAmount] = React.useState("");
  const [rejectReason, setRejectReason] = React.useState("");
  const [disAccount, setDisAccount] = React.useState("");
  const [disAmount, setDisAmount] = React.useState("");
  const [disMethod, setDisMethod] = React.useState<"TRANSFER" | "TUNAI">("TRANSFER");
  const [disDate, setDisDate] = React.useState(today());
  const [disFileId, setDisFileId] = React.useState<number | null>(null);
  const [disEmployee, setDisEmployee] = React.useState<{ id: string; name: string } | null>(null);
  const [itDate, setItDate] = React.useState(today());
  const [itDesc, setItDesc] = React.useState("");
  const [itAmount, setItAmount] = React.useState("");
  const [itCategory, setItCategory] = React.useState("");
  const [itFiles, setItFiles] = React.useState<number[]>([]);
  const [itKey, setItKey] = React.useState(0);
  const [reportNote, setReportNote] = React.useState("");
  const [leftover, setLeftover] = React.useState<"RETURN" | "KEEP">("RETURN");
  const [shortageFrom, setShortageFrom] = React.useState<"CASH" | "WALLET">("CASH");
  const [retAccount, setRetAccount] = React.useState("");
  const [retFileId, setRetFileId] = React.useState<number | null>(null);
  const [reimAccount, setReimAccount] = React.useState("");

  if (!row) {
    return (
      <DialogContent className="w-[94vw] max-w-lg">
        <Text className="text-sm text-muted-foreground py-6 text-center">Memuat...</Text>
      </DialogContent>
    );
  }

  const isHolder = Number(user?.id) === row.employeeId || isFinance;
  const isRequester = Number(user?.id) === row.requestedById;
  const disbursed = row.disbursedAmount ?? 0;
  const categories: any[] = (data as any).expenseCategories ?? [];
  const leftoverAmt = Math.max(0, disbursed - row.reportedTotal);
  const shortageAmt = Math.max(0, row.reportedTotal - disbursed);

  return (
    <DialogContent className="w-[94vw] max-w-xl max-h-[92vh]">
      <DialogHeader>
        <DialogTitle className="flex-row items-center gap-2">
          <Text className="text-base font-bold">{row.number}</Text>
          <StatusBadge status={STATUS_LABEL[row.status]} />
        </DialogTitle>
      </DialogHeader>
      <ScrollView className="max-h-[74vh]" showsVerticalScrollIndicator={false}>
        <View className="gap-3 py-1">
          {/* Ringkasan */}
          <View className="rounded-xl border border-border bg-panel p-3 gap-0.5">
            <Row2 label="Keperluan" value={`${PURPOSE_LABEL[row.purpose]} — ${row.description}`} />
            {row.survey ? <Row2 label="Survey" value={`${row.survey.lead?.name ? `${row.survey.lead.name} — ` : ""}${row.survey.location}`} /> : null}
            {row.deliveryNote ? <Row2 label="Surat jalan" value={row.deliveryNote.number} /> : null}
            {row.project ? <Row2 label="Project" value={row.project.name} /> : null}
            <Row2 label="Pemegang uang" value={row.employee.name} />
            <Row2 label="Diajukan oleh" value={`${row.requestedBy.name} · ${tanggal(row.createdAt)}`} />
            <Row2 label="Nominal diajukan" value={rupiah(row.amount)} />
            {row.approvedAmount != null ? <Row2 label="Disetujui" value={`${rupiah(row.approvedAmount)}${row.approvedBy ? ` · ${row.approvedBy.name}` : ""}`} /> : null}
            {row.disbursedAmount != null ? (
              <Row2
                label="Dicairkan"
                strong
                value={`${rupiah(disbursed)} · ${row.disburseMethod === "TUNAI" ? "Tunai" : "Transfer"} ${row.disburseAccountCode ? `[${row.disburseAccountCode}]` : ""} · ${tanggal(row.disbursedAt ?? undefined)}`}
              />
            ) : null}
            {row.disburseFile ? (
              <Row2
                label="Bukti pencairan"
                value={
                  <Pressable onPress={() => openFile(row.disburseFile!.id)} className="flex-row items-center gap-1">
                    <Paperclip size={12} color={colors.primary} />
                    <Text className="text-xs text-primary underline">{row.disburseFile.originalName}</Text>
                  </Pressable>
                }
              />
            ) : null}
            {row.rejectReason ? <Row2 label="Alasan ditolak" value={row.rejectReason} /> : null}
          </View>

          {/* Kantong uang jalan dokumen ini */}
          {row.disbursedAmount != null ? (
            <View className="rounded-xl border border-primary/30 bg-primary/5 p-3 gap-0.5">
              <View className="flex-row items-center gap-1.5 mb-1">
                <Wallet size={14} color={colors.primary} />
                <Text className="text-xs font-bold text-foreground">Pemakaian uang jalan</Text>
              </View>
              <Row2 label="Uang diterima" value={rupiah(disbursed)} />
              <Row2 label="Biaya dilaporkan" value={rupiah(row.reportedTotal)} />
              {row.status === "SELESAI" ? (
                <>
                  {row.returnedAmount > 0 ? <Row2 label="Sisa dikembalikan ke kas" value={rupiah(row.returnedAmount)} /> : null}
                  {row.reimbursedAmount > 0 ? <Row2 label="Kekurangan dibayar perusahaan" value={rupiah(row.reimbursedAmount)} /> : null}
                  {row.remaining > 0 ? <Row2 label="Sisa disimpan di kantong" value={rupiah(row.remaining)} strong /> : null}
                </>
              ) : (
                <Row2
                  label={row.shortage > 0 ? "Kekurangan" : "Sisa di tangan"}
                  value={rupiah(row.shortage > 0 ? row.shortage : row.remaining)}
                  strong
                />
              )}
            </View>
          ) : null}

          {/* Rincian biaya */}
          {["DICAIRKAN", "DILAPORKAN", "SELESAI"].includes(row.status) ? (
            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-bold text-foreground">Laporan biaya ({row.items.length})</Text>
                {isHolder && ["DICAIRKAN", "DILAPORKAN"].includes(row.status) ? (
                  <Button size="sm" variant="outline" onPress={() => setPanel(panel === "item" ? null : "item")} className="flex-row items-center gap-1">
                    <Plus size={13} color={colors.text} />
                    <Text className="text-xs">Tambah biaya</Text>
                  </Button>
                ) : null}
              </View>
              {row.items.length === 0 ? (
                <Text className="text-xs text-muted-foreground">Belum ada biaya yang dilaporkan. Tambahkan setiap pengeluaran beserta foto notanya.</Text>
              ) : (
                <View className="border border-border rounded-lg overflow-hidden">
                  {row.items.map((it) => (
                    <View key={it.id} className="px-3 py-2 border-b border-border/50 flex-row items-center gap-2">
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-foreground">{it.description}</Text>
                        <Text className="text-[10px] text-muted-foreground">
                          {tanggal(it.date)}
                          {it.category?.name ? ` · ${it.category.name}` : ""}
                        </Text>
                        {it.receiptFileIds.length > 0 ? (
                          <View className="flex-row flex-wrap gap-2 mt-0.5">
                            {it.receiptFileIds.map((fid, i) => (
                              <Pressable key={fid} onPress={() => openFile(fid)} className="flex-row items-center gap-1">
                                <Paperclip size={11} color={colors.primary} />
                                <Text className="text-[10px] text-primary underline">Nota {i + 1}</Text>
                              </Pressable>
                            ))}
                          </View>
                        ) : (
                          <Text className="text-[10px] text-warning">Tanpa nota</Text>
                        )}
                      </View>
                      <Text className="text-xs font-semibold text-foreground">{rupiah(it.amount)}</Text>
                      {isHolder && ["DICAIRKAN", "DILAPORKAN"].includes(row.status) ? (
                        <Pressable
                          onPress={() => run(() => api<CashAdvance>("DELETE", `/cash-advances/${row.id}/items/${it.id}`), "Biaya dihapus")}
                          hitSlop={6}
                          accessibilityLabel="Hapus biaya"
                        >
                          <Trash2 size={14} color={colors.danger} />
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null}

          {/* Form tambah biaya */}
          {panel === "item" ? (
            <View className="rounded-xl border border-border p-3 gap-2.5">
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <FormField label="Tanggal">
                    <DatePicker value={itDate} onChange={setItDate} />
                  </FormField>
                </View>
                <View className="flex-1">
                  <FormField label="Nominal (Rp)" required>
                    <Input value={itAmount} onChangeText={(v) => setItAmount(formatThousands(v))} keyboardType="numeric" placeholder="0" />
                  </FormField>
                </View>
              </View>
              <FormField label="Keterangan" required>
                <Input value={itDesc} onChangeText={setItDesc} placeholder="Contoh: Bensin Pertalite 20 liter" />
              </FormField>
              {categories.length > 0 ? (
                <FormField label="Kategori biaya">
                  <SearchableSelect
                    value={itCategory}
                    options={categories.map((c: any) => String(c.nama || c.name))}
                    onChange={setItCategory}
                    placeholder="Pilih kategori (opsional)"
                  />
                </FormField>
              ) : null}
              <FormField label="Foto nota / struk" hint="Bisa lebih dari satu foto">
                <FileUploader
                  key={itKey}
                  label="Pilih foto nota"
                  kind="semua"
                  category="uang-jalan"
                  multiple
                  autoFlush
                  onUploaded={(fid) => setItFiles((prev) => [...prev, fid])}
                />
              </FormField>
              <Button
                disabled={busy}
                onPress={() => {
                  const amt = parseRp(itAmount);
                  if (!itDesc.trim() || amt <= 0) return toast("Isi keterangan dan nominal biaya", "danger");
                  const cat = categories.find((c: any) => String(c.nama || c.name) === itCategory);
                  void run(
                    () =>
                      api<CashAdvance>("POST", `/cash-advances/${row.id}/items`, {
                        date: itDate,
                        description: itDesc.trim(),
                        amount: amt,
                        categoryId: cat ? Number(cat.id) : undefined,
                        receiptFileIds: itFiles,
                      }),
                    "Biaya ditambahkan",
                  ).then(() => {
                    setItDesc("");
                    setItAmount("");
                    setItFiles([]);
                    setItKey((k) => k + 1);
                  });
                }}
              >
                <Text className="text-white font-semibold">Simpan biaya</Text>
              </Button>
            </View>
          ) : null}

          {/* ── Aksi per status ── */}
          {row.status === "DIAJUKAN" && isFinance ? (
            panel === "approve" ? (
              <View className="rounded-xl border border-border p-3 gap-2">
                <FormField label="Nominal disetujui (Rp)">
                  <Input value={approveAmount} onChangeText={(v) => setApproveAmount(formatThousands(v))} keyboardType="numeric" placeholder={formatThousands(row.amount)} />
                </FormField>
                <Button disabled={busy} onPress={() => run(() => api<CashAdvance>("POST", `/cash-advances/${row.id}/approve`, { approvedAmount: parseRp(approveAmount) || undefined }), "Uang jalan disetujui")}>
                  <Text className="text-white font-semibold">Setujui</Text>
                </Button>
              </View>
            ) : panel === "reject" ? (
              <View className="rounded-xl border border-border p-3 gap-2">
                <FormField label="Alasan ditolak" required>
                  <Input value={rejectReason} onChangeText={setRejectReason} placeholder="Contoh: nominal terlalu besar" />
                </FormField>
                <Button
                  variant="destructive"
                  disabled={busy || !rejectReason.trim()}
                  onPress={() => run(() => api<CashAdvance>("POST", `/cash-advances/${row.id}/reject`, { reason: rejectReason.trim() }), "Pengajuan ditolak")}
                >
                  <Text className="text-white font-semibold">Tolak pengajuan</Text>
                </Button>
              </View>
            ) : null
          ) : null}

          {row.status === "DISETUJUI" && isFinance && panel === "disburse" ? (
            <View className="rounded-xl border border-border p-3 gap-2.5">
              <FormField label="Sumber dana (akun kas / bank)" required>
                <AccountSelect value={disAccount} onChange={setDisAccount} accounts={accounts} />
              </FormField>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <FormField label="Nominal dicairkan (Rp)">
                    <Input value={disAmount} onChangeText={(v) => setDisAmount(formatThousands(v))} keyboardType="numeric" placeholder={formatThousands(row.approvedAmount ?? row.amount)} />
                  </FormField>
                </View>
                <View className="flex-1">
                  <FormField label="Tanggal">
                    <DatePicker value={disDate} onChange={setDisDate} />
                  </FormField>
                </View>
              </View>
              <FormField label="Cara pemberian">
                <ChoiceRow value={disMethod} onChange={setDisMethod} options={[{ key: "TRANSFER", title: "Transfer" }, { key: "TUNAI", title: "Tunai" }]} />
              </FormField>
              <FormField label="Diserahkan kepada" hint="Bisa diganti ke admin gudang / kurir yang ditugaskan">
                <UserSelect
                  value={disEmployee?.name ?? row.employee.name}
                  userId={disEmployee?.id ?? row.employeeId}
                  onChange={(u) => setDisEmployee(u ? { id: String(u.id), name: String(u.nama || u.name || "-") } : null)}
                  allowClear={false}
                />
              </FormField>
              <FormField label="Foto bukti transfer / serah terima uang">
                <FileUploader label="Pilih foto / PDF bukti" kind="semua" category="uang-jalan" autoFlush onUploaded={(fid) => setDisFileId(fid)} />
              </FormField>
              <Button
                disabled={busy}
                onPress={() => {
                  if (!disAccount) return toast("Pilih akun kas / bank sumber dana", "danger");
                  void run(
                    () =>
                      api<CashAdvance>("POST", `/cash-advances/${row.id}/disburse`, {
                        accountCode: disAccount,
                        amount: parseRp(disAmount) || undefined,
                        method: disMethod,
                        date: disDate,
                        fileId: disFileId ?? undefined,
                        employeeId: disEmployee ? Number(disEmployee.id) : undefined,
                      }),
                    "Uang jalan dicairkan",
                  );
                }}
              >
                <Text className="text-white font-semibold">Cairkan uang jalan</Text>
              </Button>
            </View>
          ) : null}

          {row.status === "DICAIRKAN" && isHolder ? (
            <View className="rounded-xl border border-border p-3 gap-2">
              <FormField label="Catatan laporan (opsional)">
                <Input value={reportNote} onChangeText={setReportNote} placeholder="Contoh: survey selesai, sisa uang Rp 50.000" />
              </FormField>
              <Button
                disabled={busy}
                onPress={() => run(() => api<CashAdvance>("POST", `/cash-advances/${row.id}/report`, { note: reportNote.trim() || undefined }), "Laporan dikirim ke Finance")}
              >
                <Text className="text-white font-semibold">Kirim laporan biaya ke Finance</Text>
              </Button>
            </View>
          ) : null}

          {row.status === "DILAPORKAN" && isFinance && panel === "settle" ? (
            <View className="rounded-xl border border-border p-3 gap-2.5">
              {leftoverAmt > 0 ? (
                <>
                  <FormField label={`Sisa uang ${rupiah(leftoverAmt)}`}>
                    <ChoiceRow
                      value={leftover}
                      onChange={setLeftover}
                      options={[
                        { key: "RETURN", title: "Dikembalikan ke kas", desc: "Karyawan menyetor sisa uang" },
                        { key: "KEEP", title: "Simpan di kantong", desc: "Dipakai untuk tugas berikutnya" },
                      ]}
                    />
                  </FormField>
                  {leftover === "RETURN" ? (
                    <>
                      <FormField label="Dikembalikan ke akun" required>
                        <AccountSelect value={retAccount} onChange={setRetAccount} accounts={accounts} />
                      </FormField>
                      <FormField label="Bukti pengembalian (opsional)">
                        <FileUploader label="Pilih foto / PDF" kind="semua" category="uang-jalan" autoFlush onUploaded={(fid) => setRetFileId(fid)} />
                      </FormField>
                    </>
                  ) : null}
                </>
              ) : null}
              {shortageAmt > 0 ? (
                <>
                  <FormField label={`Biaya lebih besar ${rupiah(shortageAmt)} dari uang jalan`}>
                    <ChoiceRow
                      value={shortageFrom}
                      onChange={setShortageFrom}
                      options={[
                        { key: "CASH", title: "Dibayar dari kas", desc: "Finance mengganti kekurangan" },
                        { key: "WALLET", title: "Potong saldo kantong", desc: "Pakai sisa uang jalan sebelumnya" },
                      ]}
                    />
                  </FormField>
                  {shortageFrom === "CASH" ? (
                    <FormField label="Dibayar dari akun" required>
                      <AccountSelect value={reimAccount} onChange={setReimAccount} accounts={accounts} />
                    </FormField>
                  ) : null}
                </>
              ) : null}
              {leftoverAmt === 0 && shortageAmt === 0 ? <Text className="text-xs text-muted-foreground">Biaya sama persis dengan uang jalan. Tidak ada sisa / kekurangan.</Text> : null}
              <Button
                disabled={busy}
                onPress={() => {
                  if (leftoverAmt > 0 && leftover === "RETURN" && !retAccount) return toast("Pilih akun tujuan pengembalian sisa", "danger");
                  if (shortageAmt > 0 && shortageFrom === "CASH" && !reimAccount) return toast("Pilih akun untuk membayar kekurangan", "danger");
                  void run(
                    () =>
                      api<CashAdvance>("POST", `/cash-advances/${row.id}/settle`, {
                        leftoverAction: leftover,
                        returnAccountCode: retAccount || undefined,
                        returnFileId: retFileId ?? undefined,
                        shortageFrom,
                        reimburseAccountCode: reimAccount || undefined,
                      }),
                    "Laporan diverifikasi & dibukukan",
                  );
                }}
              >
                <Text className="text-white font-semibold">Verifikasi & selesaikan</Text>
              </Button>
            </View>
          ) : null}
        </View>
      </ScrollView>
      <DialogFooter className="flex-row flex-wrap gap-2">
        {row.status === "DIAJUKAN" && isFinance ? (
          <>
            <Button variant="outline" onPress={() => setPanel(panel === "reject" ? null : "reject")} disabled={busy}>
              <Text className="text-danger">Tolak</Text>
            </Button>
            <Button onPress={() => setPanel(panel === "approve" ? null : "approve")} disabled={busy}>
              <Text className="text-white font-semibold">Setujui</Text>
            </Button>
          </>
        ) : null}
        {row.status === "DISETUJUI" && isFinance && panel !== "disburse" ? (
          <Button onPress={() => setPanel("disburse")} disabled={busy}>
            <Text className="text-white font-semibold">Cairkan uang</Text>
          </Button>
        ) : null}
        {row.status === "DILAPORKAN" && isFinance && panel !== "settle" ? (
          <Button onPress={() => setPanel("settle")} disabled={busy}>
            <Text className="text-white font-semibold">Verifikasi laporan</Text>
          </Button>
        ) : null}
        {["DIAJUKAN", "DISETUJUI"].includes(row.status) && (isRequester || isFinance) ? (
          <Button variant="ghost" onPress={() => run(() => api<CashAdvance>("POST", `/cash-advances/${row.id}/cancel`, {}), "Pengajuan dibatalkan")} disabled={busy}>
            <Text className="text-muted-foreground">Batalkan pengajuan</Text>
          </Button>
        ) : null}
        <Button variant="outline" onPress={onClose}>
          <Text>Tutup</Text>
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
