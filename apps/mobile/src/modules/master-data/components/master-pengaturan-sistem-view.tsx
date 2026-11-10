import * as React from "react";
import { View } from "react-native";
import { ArrowLeft, Building2, FileText, Shield } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel } from "@/components/taska/basics";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import { CompanyProfileDialog } from "@/modules/settings/company-profile-dialog";
import { RoleManagementDialog } from "@/modules/users/role-management-dialog";

interface MasterPengaturanSistemViewProps {
  user: any;
  onBack: () => void;
  toast: (msg: string, type?: "success" | "danger" | "info" | "warning") => void;
}

export function MasterPengaturanSistemView({
  user,
  onBack,
  toast,
}: MasterPengaturanSistemViewProps) {
  const { companyProfile, docFormats, roles } = useApp();
  const [thresholdInput, setThresholdInput] = React.useState("10000000");
  const [ppnInput, setPpnInput] = React.useState("11");
  const [companyDialogOpen, setCompanyDialogOpen] = React.useState(false);
  const [companyDialogTab, setCompanyDialogTab] = React.useState<"company" | "formats">("company");
  const [roleDialogOpen, setRoleDialogOpen] = React.useState(false);

  React.useEffect(() => {
    void (async () => {
      try {
        const res = await api<any[]>("GET", "/settings");
        if (Array.isArray(res)) {
          const thr = res.find((s) => s.key === "ambang.persetujuan");
          const ppn = res.find((s) => s.key === "ppn.persen");
          if (thr?.value) setThresholdInput(String(thr.value));
          if (ppn?.value) setPpnInput(String(ppn.value));
        }
      } catch {}
    })();
  }, []);

  const isSuper = user?.role === "super_admin";
  const canEditSettings = isSuper || user?.role === "bos" || user?.role === "admin";

  async function handleSaveSettings() {
    try {
      await Promise.all([
        api("PUT", "/settings/ambang.persetujuan", {
          value: String(Number(String(thresholdInput).replace(/\D/g, "")) || 10000000),
          description: "Ambang nilai persetujuan Bos (Rp)",
        }),
        api("PUT", "/settings/ppn.persen", {
          value: String(Number(String(ppnInput).replace(/\D/g, "")) || 11),
          description: "Persentase PPN standar",
        }),
      ]);
      toast("Pengaturan sistem & ambang batas persetujuan berhasil disimpan ke server!");
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyimpan pengaturan", "danger");
    }
  }

  return (
    <View className="gap-5">
      <PageHeader
        back
        title="Pengaturan & Kebijakan Sistem"
        subtitle="Kebijakan global operasional ERP (Dikelola Administrator)"
        action={
          <Button variant="outline" size="sm" onPress={onBack}>
            <ArrowLeft size={15} color={colors.text} />
            <Text className="text-xs">Kembali</Text>
          </Button>
        }
      />
      <Panel
        title="Ambang Batas Persetujuan Bos (BOS Approval Threshold)"
        subtitle="Dokumen pembelian, penawaran, faktur, dan pengeluaran di atas nilai ini wajib disetujui Bos selain Finance."
      >
        <View className="gap-4">
          <View className="flex-row items-center gap-3">
            <Text className="text-sm font-semibold text-muted-foreground w-40">Nilai Ambang Batas (Rp):</Text>
            <View className="flex-1 max-w-sm">
              <Input
                value={thresholdInput}
                onChangeText={setThresholdInput}
                keyboardType="numeric"
                placeholder="10000000"
              />
            </View>
          </View>
          <Text className="text-xs text-primary font-mono">
            Format Aktif: {rupiah(Number(thresholdInput) || 10000000)}
          </Text>
        </View>
      </Panel>

      <Panel
        title="Tarif PPN Standar Nasional"
        subtitle="Tarif pajak pertambahan nilai yang dihitung otomatis pada Faktur dan Penawaran."
      >
        <View className="gap-4">
          <View className="flex-row items-center gap-3">
            <Text className="text-sm font-semibold text-muted-foreground w-40">Tarif PPN (%):</Text>
            <View className="flex-1 max-w-sm">
              <Input
                value={ppnInput}
                onChangeText={setPpnInput}
                keyboardType="numeric"
                placeholder="11"
              />
            </View>
          </View>
          <Text className="text-xs text-muted-foreground">
            Tarif saat ini: {ppnInput || "11"}%
          </Text>
        </View>
      </Panel>

      <Panel
        title="Profil Perusahaan, Logo & Kop Dokumen (White-Label)"
        subtitle="Nama perusahaan, logo, alamat, rekening bank, dan penandatangan default untuk seluruh cetakan dokumen."
        right={
          canEditSettings ? (
            <Button
              size="sm"
              variant="outline"
              onPress={() => {
                setCompanyDialogTab("company");
                setCompanyDialogOpen(true);
              }}
              className="flex-row items-center gap-1.5"
            >
              <Building2 size={14} color={colors.primary} />
              <Text className="text-xs font-semibold text-primary">Atur Profil & Logo Perusahaan</Text>
            </Button>
          ) : null
        }
      >
        <View className="gap-1.5">
          <Text className="text-sm font-bold text-foreground">{companyProfile.name || "PT Samtek"}</Text>
          <Text className="text-xs text-muted-foreground">{companyProfile.tagline || "-"}</Text>
          <Text className="text-xs text-muted-foreground">{companyProfile.address || "-"}</Text>
          {companyProfile.bankAccount ? (
            <Text className="text-xs text-primary font-medium">
              Rekening Default: {companyProfile.bankName} — {companyProfile.bankAccount} a.n {companyProfile.bankHolder || companyProfile.name}
            </Text>
          ) : null}
        </View>
      </Panel>

      <Panel
        title="Manajemen Role & Matriks Hak Akses (Dynamic RBAC)"
        subtitle="Buat role kustom baru atau sesuaikan izin akses per modul dan aksi."
        right={
          canEditSettings ? (
            <Button
              size="sm"
              variant="outline"
              onPress={() => setRoleDialogOpen(true)}
              className="flex-row items-center gap-1.5"
            >
              <Shield size={14} color={colors.primary} />
              <Text className="text-xs font-semibold text-primary">Kelola Role & Hak Akses ({roles.length} Role)</Text>
            </Button>
          ) : null
        }
      >
        <View className="flex-row flex-wrap gap-1.5">
          {roles.map((r) => (
            <View key={r.code} className="bg-panel border border-border rounded-lg px-2.5 py-1">
              <Text className="text-xs font-semibold text-foreground">{r.name}</Text>
            </View>
          ))}
        </View>
      </Panel>

      <Panel
        title="Format Penomoran Dokumen Otomatis"
        subtitle="Template kode penomoran yang di-generate otomatis oleh modul (mendukung {YYYY}, {MM}, {ROMAN_MM}, {NNN})."
        right={
          canEditSettings ? (
            <Button
              size="sm"
              variant="outline"
              onPress={() => {
                setCompanyDialogTab("formats");
                setCompanyDialogOpen(true);
              }}
              className="flex-row items-center gap-1.5"
            >
              <FileText size={14} color={colors.primary} />
              <Text className="text-xs font-semibold text-primary">Kustomisasi Format Nomor</Text>
            </Button>
          ) : null
        }
      >
        <View className="gap-2">
          <Text className="text-xs font-mono text-muted-foreground">Penawaran: {docFormats.penawaran || "QUO/{YYYY}/{MM}/{NNN}"}</Text>
          <Text className="text-xs font-mono text-muted-foreground">Sales Order (SO): {docFormats.salesOrder || "SO/{YYYY}/{MM}/{NNN}"}</Text>
          <Text className="text-xs font-mono text-muted-foreground">PO Supplier: {docFormats.poSupplier || "PO/{YYYY}/{MM}/{NNN}"}</Text>
          <Text className="text-xs font-mono text-muted-foreground">Invoice: {docFormats.invoice || "INV/{YYYY}/{MM}/{NNN}"}</Text>
          <Text className="text-xs font-mono text-muted-foreground">Surat Jalan: {docFormats.suratJalan || "SJN/{YYYY}/{MM}/{NNN}"}</Text>
        </View>
      </Panel>

      {canEditSettings ? (
        <Button onPress={handleSaveSettings} className="self-start">
          <Text>Simpan Perubahan Pengaturan</Text>
        </Button>
      ) : null}

      <CompanyProfileDialog
        open={companyDialogOpen}
        onOpenChange={setCompanyDialogOpen}
        initialTab={companyDialogTab}
      />
      <RoleManagementDialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen} />
    </View>
  );
}

