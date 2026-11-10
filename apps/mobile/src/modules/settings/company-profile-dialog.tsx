import * as React from "react";
import { View, ScrollView, Image, Pressable } from "react-native";
import { Building2, FileText, Trash2, RotateCcw, CheckCircle2 } from "lucide-react-native";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/text";
import { FormField } from "@/components/taska/basics";
import { FileUploader } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { apiBase, uploadFile } from "@/services/api";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import type { CompanyProfile } from "@/constants/modules";

const DOC_FORMAT_ITEMS: { key: string; label: string; defaultFormat: string; desc: string }[] = [
  {
    key: "penawaran",
    label: "Penawaran Harga (Quotation)",
    defaultFormat: "QUO/{YYYY}/{MM}/{NNN}",
    desc: "Digunakan saat membuat penawaran baru dari Leads atau menu Penawaran",
  },
  {
    key: "salesOrder",
    label: "Sales Order (SO / PO Masuk)",
    defaultFormat: "SO/{YYYY}/{MM}/{NNN}",
    desc: "Digunakan saat menerbitkan dokumen Sales Order (SO) untuk pelanggan",
  },
  {
    key: "poSupplier",
    label: "Purchase Order (PO Supplier / PO Keluar)",
    defaultFormat: "PO/{YYYY}/{MM}/{NNN}",
    desc: "Digunakan saat menerbitkan PO pembelian barang ke supplier/vendor",
  },
  {
    key: "invoice",
    label: "Invoice / Faktur Penagihan",
    defaultFormat: "INV/{YYYY}/{MM}/{NNN}",
    desc: "Digunakan saat menerbitkan tagihan DP, Termin, atau Pelunasan customer",
  },
  {
    key: "suratJalan",
    label: "Surat Jalan / Delivery Order (DO)",
    defaultFormat: "SJN/{YYYY}/{MM}/{NNN}",
    desc: "Digunakan saat menerbitkan dokumen pengiriman barang & penugasan luar",
  },
  {
    key: "request",
    label: "Purchase Request (PR / Request Barang)",
    defaultFormat: "PR/{YYYY}/{MM}/{NNN}",
    desc: "Digunakan saat pengajuan kebutuhan pengadaan barang proyek/gudang",
  },
  {
    key: "penerimaan",
    label: "Penerimaan Barang (GRN / Receiving)",
    defaultFormat: "RCV/{YYYY}/{MM}/{NNN}",
    desc: "Digunakan saat mencatat barang masuk dari PO supplier di gudang",
  },
  {
    key: "kerusakan",
    label: "Laporan Kerusakan & Retur",
    defaultFormat: "DMG/{YYYY}/{MM}/{NNN}",
    desc: "Digunakan saat mencatat retur barang atau klaim unit rusak",
  },
];

const ROMAN_MONTHS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

function renderFormatPreview(fmt: string, seq = 1): string {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const yy = yyyy.slice(-2);
  const mIdx = now.getMonth();
  const mm = String(mIdx + 1).padStart(2, "0");
  const romanMm = ROMAN_MONTHS[mIdx] ?? "I";
  return (fmt || "")
    .replace(/\{TAHUN\}|\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yy)
    .replace(/\{BULAN\}|\{MM\}/g, mm)
    .replace(/\{ROMAN_MM\}|\{BULAN_ROMAWI\}/g, romanMm)
    .replace(/\{SEQ4\}|\{NNNN\}/g, String(seq).padStart(4, "0"))
    .replace(/\{SEQ3\}|\{NNN\}/g, String(seq).padStart(3, "0"))
    .replace(/\{SEQ\}/g, String(seq));
}

export function CompanyProfileDialog({
  open,
  onOpenChange,
  initialTab = "company",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialTab?: "company" | "formats";
}) {
  const { companyProfile, updateCompanyProfile, docFormats, updateDocFormats, toast } = useApp();
  const [tab, setTab] = React.useState<"company" | "formats">(initialTab);
  const [form, setForm] = React.useState<CompanyProfile>(companyProfile);
  const [formats, setFormats] = React.useState<Record<string, string>>({});
  const [previousInputs, setPreviousInputs] = React.useState({ open, initialTab, companyProfile, docFormats });
  const [saving, setSaving] = React.useState(false);
  const [uploadingLogo, setUploadingLogo] = React.useState(false);

  if (
    open !== previousInputs.open ||
    initialTab !== previousInputs.initialTab ||
    companyProfile !== previousInputs.companyProfile ||
    docFormats !== previousInputs.docFormats
  ) {
    setPreviousInputs({ open, initialTab, companyProfile, docFormats });
    if (open) {
      setTab(initialTab);
      setForm(companyProfile);
      const nextFmt: Record<string, string> = {};
      for (const item of DOC_FORMAT_ITEMS) {
        nextFmt[item.key] = docFormats[item.key] || item.defaultFormat;
      }
      setFormats(nextFmt);
    }
  }

  const setField = (k: keyof CompanyProfile, v: string) => {
    setForm((prev) => ({ ...prev, [k]: v }));
  };

  async function handleLogoPicked(file: { name: string; blob?: Blob; uri?: string }) {
    setUploadingLogo(true);
    try {
      const payload =
        file.blob ?? (file.uri ? { uri: file.uri, name: file.name, type: "image/png" } : file);
      const uploadedId = await uploadFile(payload, "foto", "lainnya");
      if (uploadedId) {
        setForm((prev) => ({ ...prev, logoFileId: String(uploadedId) }));
        toast("Logo perusahaan berhasil diunggah");
      } else {
        toast("Gagal mengunggah logo", "danger");
      }
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengunggah logo", "danger");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (tab === "company") {
        if (!form.name.trim()) {
          toast("Nama perusahaan wajib diisi", "danger");
          return;
        }
        await updateCompanyProfile(form);
      } else {
        await updateDocFormats(formats);
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const logoPreviewUrl = form.logoFileId ? `${apiBase()}/files/${form.logoFileId}` : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-4xl max-h-[92vh] p-4 sm:p-6">
        <DialogHeader>
          <View className="flex-row flex-wrap items-center justify-between gap-2 pr-6">
            <View className="flex-row items-center gap-2.5">
              <View className="size-9 rounded-xl bg-primary/15 items-center justify-center">
                <Building2 size={18} color={colors.primary} />
              </View>
              <View>
                <DialogTitle className="text-base sm:text-lg font-bold">
                  Profil Perusahaan, Template Dokumen & Format Nomor
                </DialogTitle>
                <Text className="text-xs text-muted-foreground">
                  Pusat pengaturan identitas perusahaan (White-Label) untuk seluruh cetakan dokumen & penomoran otomatis
                </Text>
              </View>
            </View>
          </View>

          {/* Tab Switcher */}
          <View className="flex-row items-center gap-2 pt-3">
            <Pressable
              onPress={() => setTab("company")}
              className={cn(
                "px-3.5 py-2 rounded-xl border flex-row items-center gap-2",
                tab === "company"
                  ? "bg-primary/15 border-primary"
                  : "bg-panel/60 border-border hover:bg-panel",
              )}
            >
              <Building2 size={15} color={tab === "company" ? colors.primary : colors.textSecondary} />
              <Text className={cn("text-xs font-bold", tab === "company" ? "text-primary" : "text-foreground")}>
                Profil, Logo & Kop Dokumen
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTab("formats")}
              className={cn(
                "px-3.5 py-2 rounded-xl border flex-row items-center gap-2",
                tab === "formats"
                  ? "bg-primary/15 border-primary"
                  : "bg-panel/60 border-border hover:bg-panel",
              )}
            >
              <FileText size={15} color={tab === "formats" ? colors.primary : colors.textSecondary} />
              <Text className={cn("text-xs font-bold", tab === "formats" ? "text-primary" : "text-foreground")}>
                Format Nomor Dokumen Kustom
              </Text>
            </Pressable>
          </View>
        </DialogHeader>

        <ScrollView style={{ maxHeight: 540 }} showsVerticalScrollIndicator={false}>
          {tab === "company" ? (
            <View className="gap-4 py-2">
              <View className="bg-primary/10 border border-primary/30 rounded-xl p-3 flex-row items-start gap-2.5">
                <CheckCircle2 size={16} color={colors.primary} />
                <Text className="text-xs text-foreground flex-1 leading-relaxed">
                  Data & Logo yang diisi di sini otomatis menjadi nilai default pada pembuatan{" "}
                  <Text className="text-xs font-bold">
                    Penawaran (Quotation), Invoice, BAST, Surat Jalan (DO), PO, SO, Laporan Survey, Laporan POC, dan Laporan Kunjungan
                  </Text>
                  . Saat membuat dokumen individual, pengguna tetap dapat mengubah atau mengunggah logo khusus bila diperlukan.
                </Text>
              </View>

              {/* Logo Perusahaan */}
              <View className="bg-panel/50 border border-border rounded-xl p-4 gap-3">
                <View className="flex-row flex-wrap items-center justify-between gap-3">
                  <View className="flex-1 min-w-[220px]">
                    <Text className="text-sm font-bold text-foreground">Logo Resmi Perusahaan (Default Kop Surat)</Text>
                    <Text className="text-xs text-muted-foreground mt-0.5">
                      Format PNG/JPG transparan disarankan agar rapi pada cetakan PDF & Excel
                    </Text>
                  </View>
                  {logoPreviewUrl ? (
                    <View className="flex-row items-center gap-2 bg-white border border-border rounded-xl px-3 py-2">
                      <Image
                        source={{ uri: logoPreviewUrl }}
                        style={{ width: 110, height: 42, resizeMode: "contain" }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => setField("logoFileId", "")}
                        className="h-8 px-2"
                      >
                        <Trash2 size={14} color={colors.danger} />
                      </Button>
                    </View>
                  ) : null}
                </View>
                <FileUploader
                  label={
                    uploadingLogo
                      ? "Mengunggah logo..."
                      : form.logoFileId
                        ? "Ganti Logo Perusahaan (PNG / JPG)"
                        : "Unggah Logo Perusahaan (PNG / JPG)"
                  }
                  kind="foto"
                  onFilePicked={handleLogoPicked}
                />
              </View>

              {/* Identitas Utama */}
              <View className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Nama Resmi Perusahaan" required>
                  <Input
                    value={form.name}
                    onChangeText={(v) => setField("name", v)}
                    placeholder="Contoh: PT Samtek Mandiri Solusi"
                  />
                </FormField>
                <FormField label="Bidang Usaha / Tagline Kop">
                  <Input
                    value={form.tagline}
                    onChangeText={(v) => setField("tagline", v)}
                    placeholder="Contoh: General Contractor, IT & Security System Integrator"
                  />
                </FormField>
              </View>

              <View className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField label="Kota Kedudukan (Tempat Terbit Dokumen)">
                  <Input
                    value={form.city}
                    onChangeText={(v) => setField("city", v)}
                    placeholder="Contoh: Bekasi / Jakarta"
                  />
                </FormField>
                <FormField label="Nomor Telepon Kantor">
                  <Input
                    value={form.phone}
                    onChangeText={(v) => setField("phone", v)}
                    placeholder="Contoh: 021-88991122"
                  />
                </FormField>
                <FormField label="Email Resmi">
                  <Input
                    value={form.email}
                    onChangeText={(v) => setField("email", v)}
                    placeholder="Contoh: info@perusahaan.co.id"
                  />
                </FormField>
              </View>

              <FormField label="Alamat Lengkap Kantor (Tampil di Kop Dokumen)">
                <Textarea
                  value={form.address}
                  onChangeText={(v) => setField("address", v)}
                  placeholder="Jl. Raya Bisnis No. 10, Bekasi Barat..."
                  numberOfLines={2}
                />
              </FormField>

              <View className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="NPWP Perusahaan">
                  <Input
                    value={form.npwp}
                    onChangeText={(v) => setField("npwp", v)}
                    placeholder="00.000.000.0-000.000"
                  />
                </FormField>
                <FormField label="Website">
                  <Input
                    value={form.website}
                    onChangeText={(v) => setField("website", v)}
                    placeholder="https://www.perusahaan.co.id"
                  />
                </FormField>
              </View>

              {/* Rekening Bank & Penandatangan */}
              <View className="border-t border-border/60 pt-3 gap-3">
                <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Rekening Bank Default (Untuk Catatan Pembayaran Invoice) & Penandatangan
                </Text>
                <View className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormField label="Nama Bank">
                    <Input
                      value={form.bankName}
                      onChangeText={(v) => setField("bankName", v)}
                      placeholder="Contoh: Bank Mandiri / BCA"
                    />
                  </FormField>
                  <FormField label="Nomor Rekening">
                    <Input
                      value={form.bankAccount}
                      onChangeText={(v) => setField("bankAccount", v)}
                      placeholder="Contoh: 1670011359410"
                    />
                  </FormField>
                  <FormField label="Atas Nama Rekening">
                    <Input
                      value={form.bankHolder}
                      onChangeText={(v) => setField("bankHolder", v)}
                      placeholder="Contoh: PT Samtek Mandiri"
                    />
                  </FormField>
                </View>

                <View className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Nama Penandatangan Default">
                    <Input
                      value={form.signatoryName}
                      onChangeText={(v) => setField("signatoryName", v)}
                      placeholder="Nama Direktur / Pejabat Berwenang"
                    />
                  </FormField>
                  <FormField label="Jabatan Penandatangan Default">
                    <Input
                      value={form.signatoryTitle}
                      onChangeText={(v) => setField("signatoryTitle", v)}
                      placeholder="Contoh: Direktur Utama / Finance Manager"
                    />
                  </FormField>
                </View>
              </View>
            </View>
          ) : (
            <View className="gap-4 py-2">
              <View className="bg-panel/60 border border-border rounded-xl p-3.5 gap-2">
                <Text className="text-xs font-bold text-foreground">
                  Panduan Variabel Format Nomor Dokumen (Non-Breaking):
                </Text>
                <Text className="text-xs text-muted-foreground leading-relaxed">
                  Perubahan format hanya berlaku untuk dokumen baru yang dibuat setelah disimpan dan tidak mengubah nomor dokumen historis yang sudah terbit. Gunakan variabel berikut:
                </Text>
                <View className="flex-row flex-wrap gap-2 pt-1">
                  {[
                    { token: "{YYYY}", desc: "Tahun 4 digit (2026)" },
                    { token: "{YY}", desc: "Tahun 2 digit (26)" },
                    { token: "{MM}", desc: "Bulan angka (01-12)" },
                    { token: "{ROMAN_MM}", desc: "Bulan Romawi (I-XII)" },
                    { token: "{NNN}", desc: "Urut 3 digit (001)" },
                    { token: "{NNNN}", desc: "Urut 4 digit (0001)" },
                  ].map((t) => (
                    <View
                      key={t.token}
                      className="bg-card border border-border rounded-lg px-2.5 py-1 flex-row items-center gap-1.5"
                    >
                      <Text className="text-xs font-mono font-bold text-primary">{t.token}</Text>
                      <Text className="text-[11px] text-muted-foreground">{t.desc}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-card">
                {DOC_FORMAT_ITEMS.map((item) => {
                  const val = formats[item.key] ?? item.defaultFormat;
                  const preview = renderFormatPreview(val, 1);
                  return (
                    <View
                      key={item.key}
                      className="p-3.5 flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <View className="flex-1 pr-2">
                        <Text className="text-xs sm:text-sm font-bold text-foreground">{item.label}</Text>
                        <Text className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</Text>
                        <View className="flex-row items-center gap-1.5 mt-1.5">
                          <Text className="text-[11px] text-muted-foreground">Contoh Hasil:</Text>
                          <View className="bg-primary/15 px-2 py-0.5 rounded">
                            <Text className="text-xs font-mono font-bold text-primary">{preview}</Text>
                          </View>
                        </View>
                      </View>
                      <View className="flex-row items-center gap-2 min-w-[260px]">
                        <Input
                          value={val}
                          onChangeText={(v) =>
                            setFormats((prev) => ({
                              ...prev,
                              [item.key]: v,
                            }))
                          }
                          placeholder={item.defaultFormat}
                          className="flex-1 font-mono text-xs"
                        />
                        <Pressable
                          onPress={() =>
                            setFormats((prev) => ({
                              ...prev,
                              [item.key]: item.defaultFormat,
                            }))
                          }
                          className="p-2 rounded-lg border border-border bg-panel/60 hover:bg-panel"
                        >
                          <RotateCcw size={14} color={colors.muted} />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>

        <DialogFooter className="pt-3 border-t border-border/60">
          <Button variant="outline" onPress={() => onOpenChange(false)}>
            <Text>Batal</Text>
          </Button>
          <Button onPress={handleSave} disabled={saving || uploadingLogo}>
            <Text>
              {saving
                ? "Menyimpan..."
                : tab === "company"
                  ? "Simpan Profil & Kop Perusahaan"
                  : "Simpan Format Nomor Dokumen"}
            </Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
