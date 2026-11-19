import * as React from "react";
import { View, ScrollView, Pressable, Linking, Image } from "react-native";
import { Printer, Plus, Pencil, Camera, Check, MapPin, CalendarDays, Users, Building2, ClipboardList, User, Wallet } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel } from "@/components/akuntra/basics";
import { DatePicker, formatThousands } from "@/components/akuntra/dialogs";
import { FileUploader, type FileUploaderHandle } from "@/components/akuntra/file-uploader";
import { useApp } from "@/store/app-store";
import { api, apiBase, downloadDocumentationPdf } from "@/services/api";
import { colors } from "@/tokens";
import { rupiah, tanggal } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { DocumentationPhotosPanel } from "@/modules/shared/documentation-photos-panel";
import { CashAdvancePanel } from "@/modules/cash-advance/cash-advance-panel";
import type { CashAdvance } from "@/modules/cash-advance/cash-advance-dialogs";

/** Sumber uang untuk biaya survey. */
type PaySource = "ADVANCE" | "WALLET" | "PERSONAL";

const FLOW = ["Diminta", "Dijadwalkan", "Berjalan", "Selesai"] as const;
const COST_CATEGORIES = ["Bensin", "Makan", "Parkir & tol", "Transport", "Perlengkapan", "Lainnya"] as const;

const fundingOf = (e: Row): { label: string; tone: string } => {
  const src = String(e.fundingSource ?? "");
  if (src === "PETTY_CASH" || src === "UANG_JALAN") return { label: "Petty cash", tone: "bg-primary/10 text-primary" };
  if (src === "TALANGAN_PRIBADI" || String(e.sumberDana ?? "").includes("Talangan")) return { label: "Uang sendiri", tone: "bg-amber-500/15 text-amber-600" };
  return { label: "Dana kantor", tone: "bg-muted text-muted-foreground" };
};

function InfoRow({ icon: Icon, label, value, action }: { icon: LucideIcon; label: string; value?: string | null; action?: React.ReactNode }) {
  if (!value || value === "-") return null;
  return (
    <View className="flex-row items-start gap-2.5 py-1.5">
      <Icon size={15} color={colors.muted} style={{ marginTop: 2 }} />
      <View className="flex-1">
        <Text className="text-[11px] text-muted-foreground">{label}</Text>
        <Text className="text-sm text-foreground">{value}</Text>
      </View>
      {action}
    </View>
  );
}

export function SurveyExtras({
  row,
  onRefresh,
  onEditInfo,
  editInfoOpen,
}: {
  row: Row;
  onRefresh?: () => Promise<void> | void;
  onEditInfo?: () => void;
  editInfoOpen?: boolean;
}) {
  const { addRow, patchRow, setStatus, can, toast, data, user, refreshModule } = useApp();
  const canUpdate = can("surveys", "U");

  // ── Catatan hasil survey ──
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [localNotes, setLocalNotes] = React.useState<string | null>(null);
  const notes = localNotes ?? (row.catatanTeknis || row.notes || row.catatan || "");
  const [noteInput, setNoteInput] = React.useState(notes);

  // ── Biaya pakai uang sendiri ──
  const [selectedExp, setSelectedExp] = React.useState<Row | null>(null);
  const [expenseOpen, setExpenseOpen] = React.useState(false);
  const [expNominal, setExpNominal] = React.useState("");
  const [expKategori, setExpKategori] = React.useState<string>("Bensin");
  const [expTanggal, setExpTanggal] = React.useState("");
  const [expKet, setExpKet] = React.useState("");
  const [expFileId, setExpFileId] = React.useState<number | null>(null);
  const fileUploaderRef = React.useRef<FileUploaderHandle | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [paySource, setPaySource] = React.useState<PaySource | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Petty cash: petty cash survey ini yang sedang saya pegang + saldo petty cash pribadi
  const [reloadKey, setReloadKey] = React.useState(0);
  const [advances, setAdvances] = React.useState<CashAdvance[]>([]);
  const [walletAvailable, setWalletAvailable] = React.useState(0);
  React.useEffect(() => {
    let alive = true;
    api<{ items: CashAdvance[] }>("GET", `/cash-advances?surveyId=${row.id}`)
      .then((res) => {
        if (alive) setAdvances(res.items ?? []);
      })
      .catch(() => {});
    api<{ mine: { available: number } | null }>("GET", "/cash-advances/wallet")
      .then((res) => {
        if (alive) setWalletAvailable(Number(res?.mine?.available ?? 0));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [row.id, reloadKey]);
  const myAdvance = advances.find((a) => a.status === "DICAIRKAN" && Number(a.employeeId) === Number(user?.id));
  const advanceLeft = myAdvance ? Math.max(0, (myAdvance.disbursedAmount ?? 0) - myAdvance.reportedTotal) : 0;
  // Petty cash yang sudah habis tidak bisa dipilih; biaya berikutnya lewat "Uang sendiri" (reimburse terpisah).
  const advanceUsable = !!myAdvance && advanceLeft > 0;
  const defaultSource: PaySource = advanceUsable ? "ADVANCE" : walletAvailable > 0 ? "WALLET" : "PERSONAL";
  const source = paySource ?? defaultSource;
  // Rincian petty cash survey yang belum diverifikasi Finance (belum jadi Pengeluaran) — ikut tampil di daftar biaya
  const pendingAdvanceItems: Row[] = advances
    .filter((a) => a.status === "DICAIRKAN" || a.status === "DILAPORKAN")
    .flatMap((a) =>
      a.items.map((it) => ({
        id: `ca-${it.id}`,
        alasan: it.description,
        kategori: it.category?.name,
        nominal: it.amount,
        tanggal: it.date,
        pelapor: a.employee?.name,
        status: "Menunggu verifikasi",
        fundingSource: "PETTY_CASH",
        receiptFileId: Array.isArray(it.receiptFileIds) ? it.receiptFileIds[0] : null,
      })),
    );

  const status = String(row.status || "Diminta");
  const cancelled = status === "Dibatalkan";
  const stepIdx = FLOW.indexOf(status as (typeof FLOW)[number]);
  const approvalPending = row.approval?.status === "Menunggu";

  const surveyExpenses = React.useMemo(
    () => (data.expenses ?? []).filter((e: Row) => (e.surveyId && String(e.surveyId) === String(row.id)) || (e.survey && String(e.survey).includes(`#${row.id}`))),
    [data.expenses, row.id],
  );
  const costRows: Row[] = [...pendingAdvanceItems, ...surveyExpenses];
  const totalCost = costRows.reduce((acc: number, e: Row) => acc + (Number(e.nominal || e.amount) || 0), 0);

  async function changeStatus(next: string, ok: string) {
    setBusy(true);
    try {
      if (await setStatus("surveys", String(row.id), next)) {
        toast(ok);
        await onRefresh?.();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveNotes() {
    const val = noteInput.trim();
    setLocalNotes(val);
    setNoteOpen(false);
    try {
      await patchRow("surveys", row.id, { catatanTeknis: val, notes: val });
      toast("Catatan hasil survey disimpan");
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyimpan catatan", "danger");
    }
  }

  function resetExpenseForm() {
    setExpenseOpen(false);
    setExpNominal("");
    setExpKet("");
    setExpTanggal("");
    setExpFileId(null);
    setPaySource(null);
  }

  async function handleAddExpense() {
    const nom = Number(expNominal.replace(/\D/g, "")) || 0;
    if (nom <= 0) return toast("Isi nominal biaya", "danger");
    if (source === "WALLET" && nom > walletAvailable)
      return toast(`Saldo petty cash Anda hanya ${rupiah(walletAvailable)}. Catat kelebihannya sebagai "Uang sendiri".`, "danger");
    if (source === "ADVANCE" && nom > advanceLeft)
      return toast(`Sisa petty cash survey hanya ${rupiah(advanceLeft)}. Catat kelebihannya sebagai "Uang sendiri".`, "danger");
    let uploadedId = expFileId;
    if (!uploadedId && fileUploaderRef.current?.hasStaged()) {
      try {
        uploadedId = await fileUploaderRef.current.flush();
      } catch {}
    }
    if (source !== "PERSONAL" && !uploadedId) return toast("Foto nota wajib untuk biaya petty cash", "danger");
    const today = new Date().toISOString().slice(0, 10);
    const description = expKet.trim() || `${expKategori} survey ${row.lead || ""}`.trim();
    const categories: any[] = (data as any).expenseCategories ?? [];
    const keyword = expKategori.split(" ")[0]!.toLowerCase();
    const cat = categories.find((c: any) => String(c.nama || c.name || "").toLowerCase().includes(keyword));

    if (source !== "PERSONAL") {
      setSaving(true);
      try {
        if (source === "ADVANCE" && myAdvance) {
          // Rincian biaya petty cash survey ini — dilaporkan ke Finance bersama nota lainnya
          await api("POST", `/cash-advances/${myAdvance.id}/items`, {
            date: expTanggal || today,
            description,
            amount: nom,
            categoryId: cat ? Number(cat.id) : undefined,
            receiptFileIds: [uploadedId],
          });
          toast(`Biaya ${rupiah(nom)} dicatat di petty cash ${myAdvance.number}. Kirim laporannya ke Finance setelah survey selesai.`);
        } else {
          // Dibayar dari saldo petty cash pribadi
          await api("POST", "/expenses", {
            date: expTanggal || today,
            description,
            amount: nom,
            categoryId: cat ? Number(cat.id) : undefined,
            surveyId: Number(row.id),
            fundingSource: "PETTY_CASH",
            receiptFileId: uploadedId,
            receiptFileIds: String(uploadedId),
          });
          await refreshModule("expenses").catch(() => {});
          toast(`Biaya ${rupiah(nom)} dibayar dari saldo petty cash. Menunggu verifikasi Finance.`);
        }
        setReloadKey((k) => k + 1);
        resetExpenseForm();
      } catch (e: any) {
        toast(e?.message ?? "Gagal mencatat biaya", "danger");
      } finally {
        setSaving(false);
      }
      return;
    }

    await addRow("expenses", {
      surveyId: Number(row.id),
      survey: `Survey #${row.id} - ${row.lead || row.customer || "Survey"}`,
      project: row.lead || row.customer || "-",
      nominal: nom,
      kategori: expKategori,
      tanggal: expTanggal || today,
      alasan: expKet.trim() || `Survey ${row.lead || ""}: ${expKategori}`.trim(),
      pelapor: user?.name || "Karyawan",
      fileId: uploadedId || null,
      receiptFileId: uploadedId || null,
      fundingSource: "TALANGAN_PRIBADI",
      sumberDana: "Talangan Pribadi (Reimbursement)",
      status: "Dilaporkan",
    });
    resetExpenseForm();
    toast(`Biaya ${rupiah(nom)} dikirim ke Finance untuk diganti`);
  }

  async function handleDownloadPdf() {
    const ok = await downloadDocumentationPdf("survey", row.id);
    if (ok) toast("Laporan survey (PDF) diunduh");
    else if (typeof window !== "undefined") window.print();
  }

  // Langkah berikutnya sesuai status
  const next: { hint: string; action?: { label: string; run: () => void } } = cancelled
    ? { hint: "Survey dibatalkan." }
    : status === "Diminta"
    ? { hint: approvalPending ? "Menunggu persetujuan PM / Finance / atasan." : "Menunggu dijadwalkan." }
    : status === "Dijadwalkan"
    ? {
        hint: `Tim berangkat ${row.jadwal ? tanggal(row.jadwal) : "sesuai jadwal"}. Butuh biaya? Ajukan petty cash di bawah.`,
        action: canUpdate ? { label: "Mulai survey", run: () => void changeStatus("Berjalan", "Survey dimulai") } : undefined,
      }
    : status === "Berjalan"
    ? {
        hint: "Tulis hasil survey & unggah foto lokasi, lalu tandai selesai.",
        action: canUpdate
          ? {
              label: "Survey selesai",
              run: () => {
                if (!notes.trim()) {
                  toast("Tulis catatan hasil survey dulu", "danger");
                  setNoteInput("");
                  setNoteOpen(true);
                  return;
                }
                void changeStatus("Selesai", "Survey ditandai selesai");
              },
            }
          : undefined,
      }
    : { hint: "Survey selesai. Hasilnya siap dipakai untuk penawaran.", action: { label: "Unduh laporan PDF", run: () => void handleDownloadPdf() } };

  const mapsUrl = row.lokasi ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(row.lokasi))}` : null;

  return (
    <>
      {/* 1. Ringkasan + tahapan */}
      <Panel>
        <View className="gap-4">
          {!cancelled ? (
            <View className="flex-row items-center">
              {FLOW.map((f, i) => {
                const done = i < stepIdx || status === "Selesai";
                const current = i === stepIdx && status !== "Selesai";
                return (
                  <React.Fragment key={f}>
                    <View className="items-center" style={{ width: 72 }}>
                      <View
                        className={`size-7 rounded-full items-center justify-center border ${
                          done ? "bg-emerald-600 border-emerald-600" : current ? "bg-primary border-primary" : "bg-card border-border"
                        }`}
                      >
                        {done ? <Check size={14} color="#fff" /> : <Text className={`text-xs font-bold ${current ? "text-white" : "text-muted-foreground"}`}>{i + 1}</Text>}
                      </View>
                      <Text className={`text-[11px] mt-1 ${current ? "text-primary font-semibold" : "text-muted-foreground"}`}>{f}</Text>
                    </View>
                    {i < FLOW.length - 1 ? <View className={`h-[2px] flex-1 -mt-4 ${i < stepIdx ? "bg-emerald-600" : "bg-border"}`} /> : null}
                  </React.Fragment>
                );
              })}
            </View>
          ) : null}

          <View className={`flex-row flex-wrap items-center gap-3 rounded-xl px-3 py-2.5 ${cancelled ? "bg-destructive/10" : "bg-primary/5"}`}>
            <Text className="text-sm text-foreground flex-1 min-w-[200px]">{next.hint}</Text>
            {next.action ? (
              <Button size="sm" disabled={busy} onPress={next.action.run}>
                <Text className="text-xs font-semibold text-white">{next.action.label}</Text>
              </Button>
            ) : null}
          </View>

          <View>
            <InfoRow icon={Building2} label="Pelanggan" value={row.customer} />
            <InfoRow
              icon={MapPin}
              label="Lokasi"
              value={row.lokasi}
              action={
                mapsUrl ? (
                  <Pressable onPress={() => Linking.openURL(mapsUrl).catch(() => {})} className="self-center">
                    <Text className="text-xs font-semibold text-primary">Buka peta</Text>
                  </Pressable>
                ) : null
              }
            />
            <InfoRow icon={CalendarDays} label="Jadwal" value={row.jadwal ? tanggal(row.jadwal) : "Belum dijadwalkan"} />
            <InfoRow icon={Users} label="Tim survey" value={row.tim || "Belum ditentukan"} />
            <InfoRow icon={ClipboardList} label="Yang perlu dicek" value={row.need} />
            <InfoRow icon={User} label="Diminta oleh" value={row.requester} />
            {Number(row.biaya || 0) > 0 ? <InfoRow icon={Wallet} label="Estimasi biaya" value={rupiah(row.biaya)} /> : null}
          </View>

          {onEditInfo && canUpdate ? (
            <Pressable onPress={onEditInfo} className="flex-row items-center gap-1.5 self-start">
              <Pencil size={13} color={colors.primary} />
              <Text className="text-xs font-semibold text-primary">{editInfoOpen ? "Tutup form ubah data" : "Ubah jadwal / tim / lokasi"}</Text>
            </Pressable>
          ) : null}
        </View>
      </Panel>

      {/* 2. Petty cash */}
      <CashAdvancePanel
        surveyId={Number(row.id)}
        purpose="SURVEY"
        defaultDescription={`Biaya survey ${row.lead || ""} ${row.lokasi || row.location || ""}`.trim()}
        title="Petty Cash Survey"
        subtitle="Minta uang ke Finance sebelum berangkat. Biayanya dicatat lewat tombol Catat biaya di bawah."
        refreshKey={reloadKey}
      />

      {/* 3. Hasil survey */}
      <Panel
        title="Hasil Survey"
        subtitle="Kondisi lokasi untuk tim penawaran & proyek"
        right={
          <View className="flex-row gap-2">
            {canUpdate ? (
              <Button
                size="sm"
                variant="outline"
                onPress={() => {
                  setNoteInput(notes);
                  setNoteOpen(true);
                }}
              >
                <Pencil size={13} color={colors.text} />
                <Text className="text-xs">{notes.trim() ? "Ubah" : "Tulis hasil"}</Text>
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onPress={() => void handleDownloadPdf()}>
              <Printer size={13} color={colors.text} />
              <Text className="text-xs">PDF</Text>
            </Button>
          </View>
        }
      >
        {notes.trim() ? (
          <Text className="text-sm leading-relaxed text-foreground">{notes}</Text>
        ) : (
          <Text className="text-xs text-muted-foreground py-1">Belum ada catatan. Tulis kondisi lokasi: plafon, jalur kabel, listrik, akses, kendala, dll.</Text>
        )}
      </Panel>

      <DocumentationPhotosPanel kind="survey" entityId={row.id} title="Foto Lokasi" subtitle="Ikut masuk ke laporan PDF survey." />

      {/* 4. Biaya survey */}
      <Panel
        title="Biaya Survey"
        subtitle={costRows.length ? `Total ${rupiah(totalCost)}` : "Bensin, makan, parkir, dll. untuk survey ini"}
        right={
          <Button size="sm" onPress={() => setExpenseOpen(true)}>
            <Plus size={13} color="#fff" />
            <Text className="text-xs font-semibold text-white">Catat biaya</Text>
          </Button>
        }
      >
        {costRows.length === 0 ? (
          <Text className="text-xs text-muted-foreground py-1">Belum ada biaya. Bisa dibayar dari petty cash atau uang sendiri.</Text>
        ) : (
          <View className="border border-border rounded-xl overflow-hidden">
            {costRows.map((exp: Row, idx: number) => {
              const f = fundingOf(exp);
              const hasReceipt = !!(exp.receiptFileId || exp.fileId || (exp.receiptFile as any)?.id);
              return (
                <Pressable
                  key={exp.id || idx}
                  onPress={() => setSelectedExp(exp)}
                  className={`px-3 py-2.5 flex-row items-center gap-3 active:bg-panel ${idx > 0 ? "border-t border-border" : ""}`}
                >
                  <View className="flex-1">
                    <Text className="text-sm text-foreground" numberOfLines={1}>
                      {exp.alasan || exp.description || exp.kategori}
                    </Text>
                    <View className="flex-row items-center gap-1.5 mt-0.5 flex-wrap">
                      <Text className="text-[11px] text-muted-foreground">
                        {tanggal(exp.tanggal || exp.date)} · {exp.pelapor || "-"} · {exp.status || "Dilaporkan"}
                      </Text>
                      <View className={`px-1.5 py-0.5 rounded ${f.tone.split(" ")[0]}`}>
                        <Text className={`text-[10px] font-medium ${f.tone.split(" ")[1]}`}>{f.label}</Text>
                      </View>
                      {hasReceipt ? <Camera size={11} color={colors.muted} /> : null}
                    </View>
                  </View>
                  <Text className="text-sm font-semibold text-foreground">{rupiah(exp.nominal || exp.amount || 0)}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Panel>

      {/* Dialog: catatan hasil survey */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hasil Survey</DialogTitle>
          </DialogHeader>
          <View className="py-2 gap-1.5">
            <Text className="text-xs text-muted-foreground">Tulis apa yang ditemukan di lokasi.</Text>
            <Textarea value={noteInput} onChangeText={setNoteInput} placeholder="Contoh: plafon gypsum, jarak ke panel listrik ±15 m, akses lewat lantai 2..." numberOfLines={5} />
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setNoteOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveNotes}>
              <Text>Simpan</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: biaya pakai uang sendiri */}
      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Catat Biaya Survey</DialogTitle>
          </DialogHeader>
          <ScrollView className="py-2">
            <View className="gap-3">
              <View className="gap-1.5">
                <Text className="text-xs font-medium text-foreground">1. Dibayar pakai</Text>
                {(
                  [
                    ...(myAdvance
                      ? [{
                          key: "ADVANCE",
                          title: `Petty cash survey ${myAdvance.number}`,
                          desc: advanceLeft > 0 ? `Sisa ${rupiah(advanceLeft)} · dilaporkan ke Finance bersama nota lain` : "Sudah habis — tidak bisa dipakai lagi",
                        }]
                      : []),
                    { key: "WALLET", title: "Saldo petty cash saya", desc: walletAvailable > 0 ? `Tersedia ${rupiah(walletAvailable)}` : "Saldo habis — tidak bisa dipakai" },
                    { key: "PERSONAL", title: "Uang sendiri (reimburse)", desc: "Tidak memotong petty cash · diganti Finance terpisah" },
                  ] as { key: PaySource; title: string; desc: string }[]
                ).map((o) => {
                  const active = source === o.key;
                  const disabled = (o.key === "WALLET" && walletAvailable <= 0) || (o.key === "ADVANCE" && advanceLeft <= 0);
                  return (
                    <Pressable
                      key={o.key}
                      disabled={disabled}
                      onPress={() => setPaySource(o.key)}
                      className={`flex-row items-center gap-2.5 rounded-xl border px-3 py-2.5 ${active ? "border-primary bg-primary/5" : "border-border bg-card"} ${disabled ? "opacity-50" : ""}`}
                    >
                      <View className={`size-4 rounded-full border-2 items-center justify-center ${active ? "border-primary" : "border-border"}`}>
                        {active ? <View className="size-2 rounded-full bg-primary" /> : null}
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-medium text-foreground">{o.title}</Text>
                        <Text className="text-[11px] text-muted-foreground">{o.desc}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <View className="gap-1.5">
                <Text className="text-xs font-medium text-foreground">2. Untuk apa?</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {COST_CATEGORIES.map((k) => (
                    <Pressable
                      key={k}
                      onPress={() => setExpKategori(k)}
                      className={`rounded-full border px-3 py-1.5 ${expKategori === k ? "bg-primary border-primary" : "bg-card border-border"}`}
                    >
                      <Text className={`text-xs ${expKategori === k ? "text-white font-semibold" : "text-foreground"}`}>{k}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View className="gap-1">
                <Text className="text-xs font-medium text-foreground">3. Nominal (Rp)</Text>
                <Input value={expNominal} onChangeText={(v) => setExpNominal(formatThousands(v))} placeholder="Contoh: 50.000" keyboardType="numeric" />
              </View>
              <View className="gap-1">
                <Text className="text-xs font-medium text-foreground">4. Foto nota{source !== "PERSONAL" ? " (wajib)" : ""}</Text>
                <FileUploader
                  label="Foto struk / nota"
                  kind="foto"
                  category="foto-struk"
                  handleRef={(h) => {
                    fileUploaderRef.current = h;
                  }}
                  onUploaded={(id) => setExpFileId(id)}
                />
              </View>
              <View className="gap-1">
                <Text className="text-xs text-muted-foreground">Keterangan (opsional)</Text>
                <Input value={expKet} onChangeText={setExpKet} placeholder="Contoh: bensin motor ke lokasi" />
              </View>
              <View className="gap-1">
                <Text className="text-xs text-muted-foreground">Tanggal</Text>
                <DatePicker value={expTanggal || new Date().toISOString().slice(0, 10)} onChange={setExpTanggal} />
              </View>
            </View>
          </ScrollView>
          <DialogFooter>
            <Button variant="outline" onPress={() => setExpenseOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleAddExpense} disabled={saving}>
              <Text>{saving ? "Menyimpan..." : source === "PERSONAL" ? "Kirim ke Finance" : "Simpan"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: detail biaya */}
      <Dialog
        open={!!selectedExp}
        onOpenChange={(open) => {
          if (!open) setSelectedExp(null);
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Detail Biaya</DialogTitle>
          </DialogHeader>
          {selectedExp
            ? (() => {
                const fid = selectedExp.receiptFileId || selectedExp.fileId || (selectedExp.receiptFile as any)?.id;
                const photoUrl = fid ? `${apiBase()}/files/${fid}` : null;
                const f = fundingOf(selectedExp);
                return (
                  <ScrollView className="py-2">
                    <View className="gap-3">
                      <View className="rounded-xl bg-primary/10 px-4 py-3">
                        <Text className="text-xs text-muted-foreground">{selectedExp.kategori || "Biaya"} · {f.label}</Text>
                        <Text className="text-2xl font-bold text-primary">{rupiah(selectedExp.nominal || selectedExp.amount || 0)}</Text>
                        <Text className="text-xs text-foreground mt-0.5">{selectedExp.alasan || selectedExp.description || "-"}</Text>
                        <Text className="text-[11px] text-muted-foreground mt-1">
                          {tanggal(selectedExp.tanggal || selectedExp.date)} · {selectedExp.pelapor || "-"} · {selectedExp.status || "Dilaporkan"}
                        </Text>
                      </View>
                      {photoUrl ? (
                        <Pressable
                          onPress={() => Linking.openURL(photoUrl).catch(() => {})}
                          className="h-56 w-full bg-muted/20 rounded-xl overflow-hidden border border-border items-center justify-center active:opacity-75"
                        >
                          <Image source={{ uri: photoUrl }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
                        </Pressable>
                      ) : (
                        <Text className="text-xs text-muted-foreground text-center py-2">Tidak ada foto nota.</Text>
                      )}
                    </View>
                  </ScrollView>
                );
              })()
            : null}
          <DialogFooter>
            <Button onPress={() => setSelectedExp(null)}>
              <Text>Tutup</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
