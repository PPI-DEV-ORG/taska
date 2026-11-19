import React from "react";
import { View, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Search, Settings2, ChevronRight, Check } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/akuntra/basics";
import { DatePicker } from "@/components/akuntra/dialogs";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { colors } from "@/tokens";
import { formatThousands } from "@/lib/format";
import { formatRupiah } from "../types";

export type EmployeeRow = {
  userId: number;
  user: { id: number; name: string; email: string; role: string; phone?: string | null; position?: string | null; department?: string | null };
  profile: Record<string, any> | null;
  salary: {
    basicSalary: number;
    allowance: number;
    mealAllowance: number;
    ptkp: string;
    hasNpwp: boolean;
    pph21Rate: number | null;
    bpjsKes: boolean;
    bpjsTk: boolean;
    bpjsJp: boolean;
    configured: boolean;
  };
  missing: string[];
};

const PTKP = ["TK/0", "TK/1", "TK/2", "TK/3", "K/0", "K/1", "K/2", "K/3"];
const EMPLOYMENT = [
  { key: "TETAP", label: "Tetap" },
  { key: "KONTRAK", label: "Kontrak" },
  { key: "HARIAN", label: "Harian" },
  { key: "MAGANG", label: "Magang" },
];
const EMPLOYMENT_LABEL: Record<string, string> = Object.fromEntries(EMPLOYMENT.map((e) => [e.key, e.label]));
const parseRp = (v: string) => Number(String(v || "").replace(/\D/g, "")) || 0;
const d10 = (v?: string | null) => (v ? String(v).slice(0, 10) : "");

function Chips<T extends string>({ value, options, onChange }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {options.map((o) => (
        <Pressable
          key={o.key}
          onPress={() => onChange(o.key)}
          className={`rounded-full border px-3 py-1.5 ${value === o.key ? "bg-primary border-primary" : "bg-card border-border"}`}
        >
          <Text className={`text-xs ${value === o.key ? "text-white font-semibold" : "text-foreground"}`}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Toggle({ value, onChange, label, hint }: { value: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="checkbox" accessibilityState={{ checked: value }} className="flex-row items-start gap-2 py-1">
      <View className={`size-5 rounded border items-center justify-center mt-0.5 ${value ? "bg-primary border-primary" : "bg-card border-border"}`}>
        {value ? <Check size={13} color="#fff" /> : null}
      </View>
      <View className="flex-1">
        <Text className="text-sm text-foreground">{label}</Text>
        {hint ? <Text className="text-[11px] text-muted-foreground">{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2.5 rounded-xl border border-border p-3">
      <Text className="text-sm font-semibold text-foreground">{title}</Text>
      {children}
    </View>
  );
}

// ─────────────── Form karyawan ───────────────

function EmployeeDialog({ row, onClose, onSaved }: { row: EmployeeRow; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp();
  const p = row.profile ?? {};
  const [f, setF] = React.useState(() => ({
    employeeNo: p.employeeNo ?? "",
    position: row.user.position ?? "",
    department: row.user.department ?? "",
    phone: row.user.phone ?? "",
    employmentType: (p.employmentType as string) || "TETAP",
    joinDate: d10(p.joinDate),
    contractEndDate: d10(p.contractEndDate),
    nik: p.nik ?? "",
    npwp: p.npwp ?? "",
    birthPlace: p.birthPlace ?? "",
    birthDate: d10(p.birthDate),
    gender: (p.gender as string) || "",
    address: p.address ?? "",
    bankName: p.bankName ?? "",
    bankAccountNo: p.bankAccountNo ?? "",
    bankAccountName: p.bankAccountName ?? "",
    bpjsKesNo: p.bpjsKesNo ?? "",
    bpjsTkNo: p.bpjsTkNo ?? "",
    emergencyName: p.emergencyName ?? "",
    emergencyPhone: p.emergencyPhone ?? "",
    basicSalary: row.salary.basicSalary ? formatThousands(row.salary.basicSalary) : "",
    allowance: row.salary.allowance ? formatThousands(row.salary.allowance) : "",
    mealAllowance: row.salary.mealAllowance ? formatThousands(row.salary.mealAllowance) : "",
    ptkp: row.salary.ptkp || "TK/0",
    hasNpwp: row.salary.hasNpwp,
    pph21Rate: row.salary.pph21Rate ? String(row.salary.pph21Rate) : "",
    bpjsKes: row.salary.bpjsKes,
    bpjsTk: row.salary.bpjsTk,
    bpjsJp: row.salary.bpjsJp,
  }));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      await api("PUT", `/hr/payroll/employees/${row.userId}`, {
        employeeNo: f.employeeNo,
        position: f.position,
        department: f.department,
        phone: f.phone,
        employmentType: f.employmentType,
        joinDate: f.joinDate || "",
        contractEndDate: f.employmentType === "KONTRAK" ? f.contractEndDate || "" : "",
        nik: f.nik,
        npwp: f.npwp,
        birthPlace: f.birthPlace,
        birthDate: f.birthDate || "",
        gender: f.gender,
        address: f.address,
        bankName: f.bankName,
        bankAccountNo: f.bankAccountNo,
        bankAccountName: f.bankAccountName,
        bpjsKesNo: f.bpjsKesNo,
        bpjsTkNo: f.bpjsTkNo,
        emergencyName: f.emergencyName,
        emergencyPhone: f.emergencyPhone,
        salary: {
          basicSalary: parseRp(f.basicSalary),
          allowance: parseRp(f.allowance),
          mealAllowance: parseRp(f.mealAllowance),
          ptkp: f.ptkp,
          hasNpwp: f.hasNpwp,
          pph21Rate: f.pph21Rate ? Number(f.pph21Rate) : null,
          bpjsKes: f.bpjsKes,
          bpjsTk: f.bpjsTk,
          bpjsJp: f.bpjsJp,
        },
      });
      toast(`Data ${row.user.name} disimpan`, "success");
      onSaved();
      onClose();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyimpan data karyawan", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="w-[94vw] max-w-2xl max-h-[92vh] p-0 overflow-hidden">
      <DialogHeader className="px-4 pt-4 pb-3 border-b border-border/60">
        <DialogTitle>{row.user.name}</DialogTitle>
        <Text className="text-xs text-muted-foreground mt-0.5">
          {row.user.email} · {row.user.role}
        </Text>
      </DialogHeader>
      <ScrollView contentContainerClassName="p-4 gap-3" style={{ maxHeight: 620 }}>
        <Section title="1. Gaji">
          <View className="flex-row flex-wrap gap-2">
            <View className="flex-1 min-w-[150px]">
              <FormField label="Gaji pokok / bulan" required>
                <Input value={f.basicSalary} onChangeText={(v) => set("basicSalary", formatThousands(v))} keyboardType="numeric" placeholder="0" />
              </FormField>
            </View>
            <View className="flex-1 min-w-[150px]">
              <FormField label="Tunjangan tetap / bulan">
                <Input value={f.allowance} onChangeText={(v) => set("allowance", formatThousands(v))} keyboardType="numeric" placeholder="0" />
              </FormField>
            </View>
            <View className="flex-1 min-w-[150px]">
              <FormField label="Uang makan / hari hadir">
                <Input value={f.mealAllowance} onChangeText={(v) => set("mealAllowance", formatThousands(v))} keyboardType="numeric" placeholder="0" />
              </FormField>
            </View>
          </View>
          <FormField label="Status PTKP (untuk PPh 21)" hint="TK = belum kawin, K = kawin, angka = jumlah tanggungan">
            <Chips value={f.ptkp} options={PTKP.map((k) => ({ key: k, label: k }))} onChange={(v) => set("ptkp", v)} />
          </FormField>
          <Toggle value={f.hasNpwp} onChange={(v) => set("hasNpwp", v)} label="Punya NPWP" hint="Tanpa NPWP, PPh 21 dikenakan 20% lebih tinggi" />
          <View className="gap-0.5">
            <Text className="text-xs font-medium text-foreground">Ikut BPJS</Text>
            <Toggle value={f.bpjsKes} onChange={(v) => set("bpjsKes", v)} label="BPJS Kesehatan" hint="Karyawan 1% · perusahaan 4%" />
            <Toggle value={f.bpjsTk} onChange={(v) => set("bpjsTk", v)} label="BPJS Ketenagakerjaan (JHT, JKK, JKM)" hint="JHT karyawan 2% · perusahaan 3,7% + JKK & JKM" />
            <Toggle value={f.bpjsJp} onChange={(v) => set("bpjsJp", v)} label="Jaminan Pensiun" hint="Karyawan 1% · perusahaan 2%" />
          </View>
          <FormField label="Tarif PPh 21 khusus % (opsional)" hint="Kosongkan agar dihitung otomatis dengan TER">
            <Input value={f.pph21Rate} onChangeText={(v) => set("pph21Rate", v.replace(/[^0-9.]/g, ""))} keyboardType="numeric" placeholder="Otomatis (TER)" />
          </FormField>
        </Section>

        <Section title="2. Pekerjaan">
          <View className="flex-row flex-wrap gap-2">
            <View className="flex-1 min-w-[150px]">
              <FormField label="No. karyawan">
                <Input value={f.employeeNo} onChangeText={(v) => set("employeeNo", v)} placeholder="Mis. EMP-001" />
              </FormField>
            </View>
            <View className="flex-1 min-w-[150px]">
              <FormField label="Jabatan">
                <Input value={f.position} onChangeText={(v) => set("position", v)} placeholder="Mis. Teknisi" />
              </FormField>
            </View>
            <View className="flex-1 min-w-[150px]">
              <FormField label="Departemen">
                <Input value={f.department} onChangeText={(v) => set("department", v)} placeholder="Mis. Operasional" />
              </FormField>
            </View>
          </View>
          <FormField label="Status karyawan">
            <Chips value={f.employmentType} options={EMPLOYMENT} onChange={(v) => set("employmentType", v)} />
          </FormField>
          <View className="flex-row flex-wrap gap-2">
            <View className="flex-1 min-w-[150px]">
              <FormField label="Tanggal masuk">
                <DatePicker value={f.joinDate} onChange={(v) => set("joinDate", v)} clearable />
              </FormField>
            </View>
            {f.employmentType === "KONTRAK" ? (
              <View className="flex-1 min-w-[150px]">
                <FormField label="Kontrak berakhir">
                  <DatePicker value={f.contractEndDate} onChange={(v) => set("contractEndDate", v)} clearable />
                </FormField>
              </View>
            ) : null}
          </View>
        </Section>

        <Section title="3. Rekening & BPJS">
          <View className="flex-row flex-wrap gap-2">
            <View className="flex-1 min-w-[120px]">
              <FormField label="Bank">
                <Input value={f.bankName} onChangeText={(v) => set("bankName", v)} placeholder="Mis. BCA" />
              </FormField>
            </View>
            <View className="flex-1 min-w-[150px]">
              <FormField label="No. rekening">
                <Input value={f.bankAccountNo} onChangeText={(v) => set("bankAccountNo", v.replace(/[^0-9]/g, ""))} keyboardType="numeric" placeholder="1234567890" />
              </FormField>
            </View>
            <View className="flex-1 min-w-[150px]">
              <FormField label="Atas nama">
                <Input value={f.bankAccountName} onChangeText={(v) => set("bankAccountName", v)} placeholder={row.user.name} />
              </FormField>
            </View>
          </View>
          <View className="flex-row flex-wrap gap-2">
            <View className="flex-1 min-w-[150px]">
              <FormField label="No. BPJS Kesehatan">
                <Input value={f.bpjsKesNo} onChangeText={(v) => set("bpjsKesNo", v)} />
              </FormField>
            </View>
            <View className="flex-1 min-w-[150px]">
              <FormField label="No. BPJS Ketenagakerjaan">
                <Input value={f.bpjsTkNo} onChangeText={(v) => set("bpjsTkNo", v)} />
              </FormField>
            </View>
          </View>
        </Section>

        <Section title="4. Data Pribadi">
          <View className="flex-row flex-wrap gap-2">
            <View className="flex-1 min-w-[150px]">
              <FormField label="NIK (KTP)">
                <Input value={f.nik} onChangeText={(v) => set("nik", v.replace(/[^0-9]/g, "").slice(0, 16))} keyboardType="numeric" placeholder="16 digit" />
              </FormField>
            </View>
            <View className="flex-1 min-w-[150px]">
              <FormField label="NPWP">
                <Input value={f.npwp} onChangeText={(v) => set("npwp", v)} placeholder="Boleh sama dengan NIK" />
              </FormField>
            </View>
            <View className="flex-1 min-w-[150px]">
              <FormField label="No. HP">
                <Input value={f.phone} onChangeText={(v) => set("phone", v)} keyboardType="phone-pad" />
              </FormField>
            </View>
          </View>
          <View className="flex-row flex-wrap gap-2">
            <View className="flex-1 min-w-[150px]">
              <FormField label="Tempat lahir">
                <Input value={f.birthPlace} onChangeText={(v) => set("birthPlace", v)} />
              </FormField>
            </View>
            <View className="flex-1 min-w-[150px]">
              <FormField label="Tanggal lahir">
                <DatePicker value={f.birthDate} onChange={(v) => set("birthDate", v)} clearable />
              </FormField>
            </View>
          </View>
          <FormField label="Jenis kelamin">
            <Chips value={f.gender} options={[{ key: "L", label: "Laki-laki" }, { key: "P", label: "Perempuan" }]} onChange={(v) => set("gender", v)} />
          </FormField>
          <FormField label="Alamat">
            <Textarea value={f.address} onChangeText={(v) => set("address", v)} placeholder="Alamat sesuai KTP / domisili" />
          </FormField>
          <View className="flex-row flex-wrap gap-2">
            <View className="flex-1 min-w-[150px]">
              <FormField label="Kontak darurat">
                <Input value={f.emergencyName} onChangeText={(v) => set("emergencyName", v)} placeholder="Nama" />
              </FormField>
            </View>
            <View className="flex-1 min-w-[150px]">
              <FormField label="No. HP kontak darurat">
                <Input value={f.emergencyPhone} onChangeText={(v) => set("emergencyPhone", v)} keyboardType="phone-pad" />
              </FormField>
            </View>
          </View>
        </Section>
      </ScrollView>
      <DialogFooter className="p-3 border-t border-border/60 flex-row justify-end gap-2">
        <Button variant="outline" onPress={onClose} disabled={saving}>
          <Text>Batal</Text>
        </Button>
        <Button onPress={save} disabled={saving}>
          <Text className="text-white font-semibold">{saving ? "Menyimpan..." : "Simpan"}</Text>
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─────────────── Aturan BPJS & pajak ───────────────

const SETTING_FIELDS: { key: string; label: string; suffix?: string; money?: boolean }[] = [
  { key: "workDays", label: "Hari kerja / bulan", suffix: "hari" },
  { key: "overtimeDivisor", label: "Pembagi upah lembur / jam", suffix: "(1/173)" },
  { key: "kesWageCap", label: "Batas upah BPJS Kesehatan", money: true },
  { key: "jpWageCap", label: "Batas upah Jaminan Pensiun", money: true },
  { key: "kesEmployeePct", label: "Kesehatan — karyawan", suffix: "%" },
  { key: "kesCompanyPct", label: "Kesehatan — perusahaan", suffix: "%" },
  { key: "jhtEmployeePct", label: "JHT — karyawan", suffix: "%" },
  { key: "jhtCompanyPct", label: "JHT — perusahaan", suffix: "%" },
  { key: "jpEmployeePct", label: "JP — karyawan", suffix: "%" },
  { key: "jpCompanyPct", label: "JP — perusahaan", suffix: "%" },
  { key: "jkkPct", label: "JKK (sesuai risiko kerja)", suffix: "%" },
  { key: "jkmPct", label: "JKM", suffix: "%" },
  { key: "noNpwpSurchargePct", label: "Tambahan PPh tanpa NPWP", suffix: "%" },
];

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useApp();
  const [vals, setVals] = React.useState<Record<string, string> | null>(null);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    api<Record<string, number>>("GET", "/hr/payroll/settings")
      .then((res) => {
        if (!alive) return;
        setVals(
          Object.fromEntries(SETTING_FIELDS.map((s) => [s.key, s.money ? formatThousands(res[s.key] ?? 0) : String(res[s.key] ?? "")])),
        );
      })
      .catch((e: any) => toast(e?.message ?? "Gagal memuat aturan payroll", "danger"));
    return () => {
      alive = false;
    };
  }, [toast]);

  async function save() {
    if (!vals) return;
    setSaving(true);
    try {
      const body = Object.fromEntries(SETTING_FIELDS.map((s) => [s.key, s.money ? parseRp(vals[s.key] ?? "") : Number(String(vals[s.key] ?? "").replace(",", "."))]));
      await api("PUT", "/hr/payroll/settings", body);
      toast("Aturan payroll disimpan. Hitung ulang gaji periode berjalan agar berlaku.", "success");
      onClose();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyimpan", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="w-[94vw] max-w-lg max-h-[90vh]">
      <DialogHeader>
        <DialogTitle>Aturan BPJS & Pajak</DialogTitle>
        <Text className="text-xs text-muted-foreground mt-0.5">
          Nilai bawaan sesuai ketentuan umum. Perbarui batas upah bila pemerintah mengubahnya. PPh 21 memakai tabel TER (PP 58/2023).
        </Text>
      </DialogHeader>
      {!vals ? (
        <ActivityIndicator className="py-6" />
      ) : (
        <ScrollView style={{ maxHeight: 480 }} contentContainerClassName="gap-2 py-1">
          {SETTING_FIELDS.map((s) => (
            <View key={s.key} className="flex-row items-center gap-2">
              <Text className="text-sm text-foreground flex-1">{s.label}</Text>
              <Input
                value={vals[s.key] ?? ""}
                onChangeText={(v) => setVals((prev) => ({ ...(prev ?? {}), [s.key]: s.money ? formatThousands(v) : v.replace(/[^0-9.,]/g, "") }))}
                keyboardType="numeric"
                className="w-32 h-9 text-right"
              />
              <Text className="text-xs text-muted-foreground w-12">{s.money ? "Rp" : s.suffix}</Text>
            </View>
          ))}
        </ScrollView>
      )}
      <DialogFooter className="flex-row justify-end gap-2">
        <Button variant="outline" onPress={onClose}>
          <Text>Batal</Text>
        </Button>
        <Button onPress={save} disabled={saving || !vals}>
          <Text className="text-white font-semibold">{saving ? "Menyimpan..." : "Simpan"}</Text>
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─────────────── Tab ───────────────

export function EmployeeMasterTab() {
  const { toast } = useApp();
  const [rows, setRows] = React.useState<EmployeeRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<EmployeeRow | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    api<EmployeeRow[]>("GET", "/hr/payroll/employees")
      .then((res) => {
        if (alive) setRows(Array.isArray(res) ? res : []);
      })
      .catch((e: any) => toast(e?.message ?? "Gagal memuat data karyawan", "danger"))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [version, toast]);

  const shown = rows.filter((r) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [r.user.name, r.user.position, r.user.department, r.profile?.employeeNo, r.user.email].some((v) => String(v ?? "").toLowerCase().includes(s));
  });
  const incomplete = rows.filter((r) => r.missing.length > 0).length;
  const noSalary = rows.filter((r) => !r.salary.configured || r.salary.basicSalary <= 0).length;
  const monthlyBase = rows.reduce((s, r) => s + r.salary.basicSalary + r.salary.allowance, 0);

  return (
    <View className="gap-4 w-full">
      <View className="flex-row flex-wrap gap-3">
        <View className="flex-1 min-w-[150px] bg-card border-border/80 rounded-2xl border p-4">
          <Text className="text-xs text-muted-foreground">Karyawan aktif</Text>
          <Text className="text-xl font-bold text-foreground mt-1">{rows.length}</Text>
        </View>
        <View className="flex-1 min-w-[150px] bg-card border-border/80 rounded-2xl border p-4">
          <Text className="text-xs text-muted-foreground">Gaji pokok + tunjangan / bulan</Text>
          <Text className="text-xl font-bold text-foreground mt-1">{formatRupiah(monthlyBase)}</Text>
        </View>
        <View className="flex-1 min-w-[150px] bg-card border-border/80 rounded-2xl border p-4">
          <Text className="text-xs text-muted-foreground">Perlu dilengkapi</Text>
          <Text className={`text-xl font-bold mt-1 ${incomplete ? "text-warning" : "text-success"}`}>{incomplete}</Text>
          {noSalary ? <Text className="text-[11px] text-muted-foreground">{noSalary} belum diisi gajinya (tidak ikut payroll)</Text> : null}
        </View>
      </View>

      <View className="bg-card border-border/80 rounded-2xl border overflow-hidden">
        <View className="flex-row flex-wrap items-center gap-2 px-4 py-3 border-b border-border/60">
          <View className="flex-1 min-w-[200px] flex-row items-center gap-2 rounded-lg border border-border bg-panel px-2.5">
            <Search size={14} color={colors.muted} />
            <Input value={q} onChangeText={setQ} placeholder="Cari nama, jabatan, no. karyawan..." className="flex-1 border-0 bg-transparent h-9 px-0" />
          </View>
          <Button size="sm" variant="outline" onPress={() => setSettingsOpen(true)} className="flex-row items-center gap-1.5">
            <Settings2 size={14} color={colors.text} />
            <Text className="text-xs">Aturan BPJS & Pajak</Text>
          </Button>
        </View>
        {loading ? (
          <ActivityIndicator className="py-10" />
        ) : shown.length === 0 ? (
          <Text className="text-xs text-muted-foreground text-center py-10">Tidak ada karyawan. Tambah akun karyawan di menu Pengguna.</Text>
        ) : (
          shown.map((r, idx) => (
            <Pressable
              key={r.userId}
              onPress={() => setEditing(r)}
              className={`flex-row items-center gap-3 px-4 py-3 active:bg-panel ${idx > 0 ? "border-t border-border/60" : ""}`}
            >
              <View className="size-9 rounded-full bg-primary/10 items-center justify-center">
                <Text className="text-sm font-bold text-primary">{(r.user.name || "?").slice(0, 1).toUpperCase()}</Text>
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                  {r.user.name}
                  {r.profile?.employeeNo ? <Text className="text-xs text-muted-foreground font-normal">{`  ${r.profile.employeeNo}`}</Text> : null}
                </Text>
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  {[r.user.position || r.user.role, r.user.department, EMPLOYMENT_LABEL[r.profile?.employmentType ?? "TETAP"]].filter(Boolean).join(" · ")}
                </Text>
                {r.missing.length ? <Text className="text-[11px] text-warning mt-0.5">Belum ada: {r.missing.join(", ")}</Text> : null}
              </View>
              <View className="items-end">
                <Text className="text-sm font-semibold text-foreground">{r.salary.basicSalary > 0 ? formatRupiah(r.salary.basicSalary) : "-"}</Text>
                <Text className="text-[11px] text-muted-foreground">{r.salary.ptkp}</Text>
              </View>
              <ChevronRight size={16} color={colors.muted} />
            </Pressable>
          ))
        )}
      </View>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        {editing ? <EmployeeDialog row={editing} onClose={() => setEditing(null)} onSaved={() => setVersion((v) => v + 1)} /> : null}
      </Dialog>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        {settingsOpen ? <SettingsDialog onClose={() => setSettingsOpen(false)} /> : null}
      </Dialog>
    </View>
  );
}
