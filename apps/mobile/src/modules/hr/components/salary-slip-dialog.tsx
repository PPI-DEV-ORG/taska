import React from "react";
import { View, ScrollView } from "react-native";
import { Printer } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { colors } from "@/tokens";
import { formatThousands } from "@/lib/format";
import { formatRupiah, formatPeriodLabel } from "../types";

interface SalarySlipDialogProps {
  selectedSlip: any;
  setSelectedSlip: (slip: any) => void;
  isFinanceOrAdmin: boolean;
  handlePaySlip: (id: string | number) => void;
  /** Dipanggil setelah slip diubah (bonus / potongan) agar daftar ikut segar. */
  onChanged?: () => void;
}

const parseRp = (v: string) => Number(String(v || "").replace(/\D/g, "")) || 0;
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function Row({ label, value, tone, bold }: { label: string; value: number; tone?: "minus" | "plus"; bold?: boolean }) {
  if (!value && !bold) return null;
  return (
    <View className="flex-row justify-between">
      <Text className={`text-xs ${bold ? "font-bold text-foreground" : "text-muted-foreground"}`}>{label}</Text>
      <Text className={`text-xs ${bold ? "font-bold" : "font-medium"} ${tone === "minus" ? "text-danger" : "text-foreground"}`}>
        {tone === "minus" ? "−" : ""}
        {formatRupiah(value)}
      </Text>
    </View>
  );
}

/** Cetak slip gaji (web) — kop dari profil perusahaan. */
function printSlip(slip: any, company: { name?: string; address?: string }) {
  if (typeof window === "undefined") return;
  const d = slip.detail ?? {};
  const e = d.employee ?? {};
  const c = d.company ?? {};
  const line = (label: string, v: number, minus = false) =>
    v ? `<tr><td>${esc(label)}</td><td class="r">${minus ? "−" : ""}${esc(formatRupiah(v))}</td></tr>` : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Slip Gaji ${esc(slip.user?.name)} ${esc(slip.period)}</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:24px}h1{font-size:16px;margin:0}h2{font-size:13px;margin:16px 0 6px}
table{width:100%;border-collapse:collapse}td{padding:3px 0}.r{text-align:right}.tot td{border-top:1px solid #999;font-weight:bold;padding-top:5px}
.box{border:1px solid #ccc;padding:10px;border-radius:6px;margin-top:10px}.muted{color:#666}.net{font-size:15px;font-weight:bold}</style></head><body>
<h1>${esc(company.name || "Perusahaan")}</h1><div class="muted">${esc(company.address || "")}</div>
<h2>SLIP GAJI — ${esc(formatPeriodLabel(slip.period))}</h2>
<table><tr><td>Nama</td><td>${esc(slip.user?.name)}</td><td>No. karyawan</td><td>${esc(slip.user?.employeeProfile?.employeeNo || "-")}</td></tr>
<tr><td>Jabatan</td><td>${esc(slip.user?.position || slip.user?.role || "-")}</td><td>Kehadiran</td><td>${slip.presentDays} hadir · ${slip.absentDays} alpha</td></tr></table>
<div class="box"><b>Penghasilan</b><table>${line("Gaji pokok", slip.basicSalary)}${line("Tunjangan tetap", slip.allowance)}${line(`Uang makan (${slip.presentDays} hari)`, slip.mealAllowance)}${line("Lembur", slip.overtimePay)}${line("Bonus / lainnya", slip.otherIncome)}${line("Potongan absen (alpha)", slip.absentDeduct, true)}
<tr class="tot"><td>Penghasilan bruto</td><td class="r">${esc(formatRupiah(slip.grossSalary))}</td></tr></table></div>
<div class="box"><b>Potongan</b><table>${line("BPJS Kesehatan (1%)", e.kes, true)}${line("BPJS JHT (2%)", e.jht, true)}${line("BPJS Jaminan Pensiun (1%)", e.jp, true)}${line(`PPh 21 (TER ${slip.terCategory || "-"} ${slip.terRate}%)`, slip.pph21, true)}${line("Cicilan pinjaman / kasbon", slip.otherDeduction, true)}</table></div>
<div class="box"><table><tr><td class="net">Gaji bersih diterima</td><td class="r net">${esc(formatRupiah(slip.netSalary))}</td></tr></table>
${slip.user?.employeeProfile?.bankAccountNo ? `<div class="muted">Ditransfer ke ${esc(slip.user.employeeProfile.bankName || "")} ${esc(slip.user.employeeProfile.bankAccountNo)} a.n. ${esc(slip.user.employeeProfile.bankAccountName || slip.user?.name)}</div>` : ""}</div>
<p class="muted">Iuran perusahaan (tidak dipotong dari gaji): BPJS Kesehatan ${esc(formatRupiah(c.kes || 0))}, JHT ${esc(formatRupiah(c.jht || 0))}, JP ${esc(formatRupiah(c.jp || 0))}, JKK ${esc(formatRupiah(c.jkk || 0))}, JKM ${esc(formatRupiah(c.jkm || 0))}.</p>
${slip.note ? `<p>Catatan: ${esc(slip.note)}</p>` : ""}
<script>window.onload=()=>{window.print()}</script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export function SalarySlipDialog({ selectedSlip, setSelectedSlip, isFinanceOrAdmin, handlePaySlip, onChanged }: SalarySlipDialogProps) {
  const { toast, companyProfile } = useApp();
  const [bonus, setBonus] = React.useState("");
  const [deduct, setDeduct] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [lastId, setLastId] = React.useState<number | null>(null);

  // Isi ulang form saat slip berganti (pola set-state-saat-render, tanpa effect)
  const sid = selectedSlip?.id ?? null;
  if (sid !== lastId) {
    setLastId(sid);
    setBonus(selectedSlip?.otherIncome ? formatThousands(selectedSlip.otherIncome) : "");
    setDeduct(selectedSlip?.otherDeduction ? formatThousands(selectedSlip.otherDeduction) : "");
    setNote(selectedSlip?.note ?? "");
  }

  const s = selectedSlip;
  const draft = s && s.status !== "PAID";
  const e = s?.detail?.employee ?? {};
  const c = s?.detail?.company ?? {};
  const changed = !!s && (parseRp(bonus) !== Number(s.otherIncome || 0) || parseRp(deduct) !== Number(s.otherDeduction || 0) || (note || "") !== (s.note || ""));

  async function saveAdjust() {
    if (!s) return;
    setSaving(true);
    try {
      const res = await api<any>("PATCH", `/hr/payroll/slips/${s.id}`, { otherIncome: parseRp(bonus), otherDeduction: parseRp(deduct), note });
      setSelectedSlip(res);
      toast("Slip dihitung ulang", "success");
      onChanged?.();
    } catch (err: any) {
      toast(err?.message ?? "Gagal menyimpan", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!s} onOpenChange={(open) => !open && setSelectedSlip(null)}>
      <DialogContent className="w-[94vw] sm:max-w-lg max-h-[92vh]">
        <DialogHeader>
          <DialogTitle>Slip Gaji</DialogTitle>
        </DialogHeader>

        {s ? (
          <ScrollView style={{ maxHeight: 560 }} contentContainerClassName="gap-3 py-1">
            <View className="bg-panel border border-border/80 rounded-xl p-3 gap-0.5">
              <Text className="text-sm font-bold text-foreground">{s.user?.name}</Text>
              <Text className="text-xs text-muted-foreground">
                {formatPeriodLabel(s.period)} · {s.user?.position || s.user?.role || "-"} · {s.presentDays} hadir · {s.absentDays} alpha
              </Text>
              <Text className={`text-[11px] font-bold mt-1 ${s.status === "PAID" ? "text-emerald-600" : "text-amber-600"}`}>
                {s.status === "PAID" ? `SUDAH DIBAYAR${s.paidAt ? ` · ${String(s.paidAt).slice(0, 10)}` : ""}` : "DRAFT — belum dibayar"}
              </Text>
            </View>

            <View className="gap-1.5 rounded-xl border border-border p-3">
              <Text className="text-xs font-bold text-foreground mb-0.5">Penghasilan</Text>
              <Row label="Gaji pokok" value={s.basicSalary} />
              <Row label="Tunjangan tetap" value={s.allowance} />
              <Row label={`Uang makan (${s.presentDays} hari)`} value={s.mealAllowance} />
              <Row label={`Lembur${s.detail?.overtimeHours ? ` (${s.detail.overtimeHours} jam)` : ""}`} value={s.overtimePay} />
              <Row label="Bonus / lainnya" value={s.otherIncome} />
              <Row label="Potongan absen (alpha)" value={s.absentDeduct} tone="minus" />
              <View className="border-t border-border pt-1">
                <Row label="Penghasilan bruto" value={s.grossSalary} bold />
              </View>
            </View>

            <View className="gap-1.5 rounded-xl border border-border p-3">
              <Text className="text-xs font-bold text-foreground mb-0.5">Potongan</Text>
              <Row label="BPJS Kesehatan (1%)" value={e.kes} tone="minus" />
              <Row label="BPJS JHT (2%)" value={e.jht} tone="minus" />
              <Row label="Jaminan Pensiun (1%)" value={e.jp} tone="minus" />
              {!s.detail && s.bpjs ? <Row label="BPJS karyawan" value={s.bpjs} tone="minus" /> : null}
              <Row label={`PPh 21${s.terCategory ? ` (TER ${s.terCategory} · ${s.terRate}% × ${formatRupiah(s.taxBase)})` : ""}`} value={s.pph21} tone="minus" />
              <Row label="Cicilan pinjaman / kasbon" value={s.otherDeduction} tone="minus" />
            </View>

            <View className="flex-row items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3.5">
              <Text className="text-xs font-bold text-foreground">GAJI BERSIH DITERIMA</Text>
              <Text className="text-base font-bold text-emerald-600">{formatRupiah(s.netSalary)}</Text>
            </View>
            {s.user?.employeeProfile?.bankAccountNo ? (
              <Text className="text-[11px] text-muted-foreground -mt-1">
                Transfer ke {s.user.employeeProfile.bankName} {s.user.employeeProfile.bankAccountNo} a.n. {s.user.employeeProfile.bankAccountName || s.user.name}
              </Text>
            ) : isFinanceOrAdmin ? (
              <Text className="text-[11px] text-warning -mt-1">Rekening karyawan belum diisi (tab Data Karyawan).</Text>
            ) : null}

            {s.bpjsCompany ? (
              <View className="rounded-xl bg-panel p-3 gap-0.5">
                <Text className="text-xs font-semibold text-foreground">Dibayar perusahaan (tidak dipotong): {formatRupiah(s.bpjsCompany)}</Text>
                <Text className="text-[11px] text-muted-foreground">
                  Kesehatan {formatRupiah(c.kes || 0)} · JHT {formatRupiah(c.jht || 0)} · JP {formatRupiah(c.jp || 0)} · JKK {formatRupiah(c.jkk || 0)} · JKM {formatRupiah(c.jkm || 0)}
                </Text>
              </View>
            ) : null}

            {draft && isFinanceOrAdmin ? (
              <View className="rounded-xl border border-primary/40 p-3 gap-2">
                <Text className="text-xs font-bold text-foreground">Tambahan bulan ini</Text>
                <View className="flex-row gap-2">
                  <View className="flex-1 gap-1">
                    <Text className="text-[11px] text-muted-foreground">Bonus / insentif / THR</Text>
                    <Input value={bonus} onChangeText={(v) => setBonus(formatThousands(v))} keyboardType="numeric" placeholder="0" />
                  </View>
                  <View className="flex-1 gap-1">
                    <Text className="text-[11px] text-muted-foreground">Cicilan pinjaman / kasbon</Text>
                    <Input value={deduct} onChangeText={(v) => setDeduct(formatThousands(v))} keyboardType="numeric" placeholder="0" />
                  </View>
                </View>
                <Input value={note} onChangeText={setNote} placeholder="Catatan (opsional)" />
                {changed ? (
                  <Button size="sm" onPress={saveAdjust} disabled={saving} className="self-end">
                    <Text className="text-xs font-semibold text-white">{saving ? "Menghitung..." : "Hitung ulang slip"}</Text>
                  </Button>
                ) : null}
              </View>
            ) : s.note ? (
              <Text className="text-xs text-muted-foreground">Catatan: {s.note}</Text>
            ) : null}
          </ScrollView>
        ) : null}

        <DialogFooter className="flex-row flex-wrap justify-end gap-2 pt-2">
          <Button variant="outline" onPress={() => setSelectedSlip(null)}>
            <Text className="text-xs font-semibold">Tutup</Text>
          </Button>
          {s ? (
            <Button variant="outline" onPress={() => printSlip(s, companyProfile)} className="flex-row items-center gap-1.5">
              <Printer size={13} color={colors.text} />
              <Text className="text-xs font-semibold">Cetak</Text>
            </Button>
          ) : null}
          {isFinanceOrAdmin && draft ? (
            <Button onPress={() => handlePaySlip(s.id)} disabled={changed} className="bg-emerald-600">
              <Text className="text-xs font-bold text-white">{changed ? "Simpan tambahan dulu" : "Bayar gaji"}</Text>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
