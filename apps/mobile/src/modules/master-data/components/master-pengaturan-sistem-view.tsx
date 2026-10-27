import * as React from "react";
import { View } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel } from "@/components/taska/basics";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import { api } from "@/services/api";

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
  const [thresholdInput, setThresholdInput] = React.useState("10000000");
  const [ppnInput, setPpnInput] = React.useState("11");

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
        subtitle="Dokumen pembelian, penawaran, invoice, dan pengeluaran di atas nilai ini wajib disetujui Bos selain Finance."
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
        subtitle="Tarif pajak pertambahan nilai yang dihitung otomatis pada Invoice dan Penawaran."
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
        title="Format Penomoran Dokumen Otomatis"
        subtitle="Template kode penomoran yang di-generate otomatis oleh modul."
      >
        <View className="gap-2">
          <Text className="text-xs font-mono text-muted-foreground">Penawaran: PNW/YYYY/MM/XXX (Contoh: PNW/2026/10/001)</Text>
          <Text className="text-xs font-mono text-muted-foreground">PO Supplier: PO/YYYY/MM/XXX (Contoh: PO/2026/10/001)</Text>
          <Text className="text-xs font-mono text-muted-foreground">Surat Jalan: SJ/YYYY/MM/XXX (Contoh: SJ/2026/10/001)</Text>
        </View>
      </Panel>

      {canEditSettings ? (
        <Button onPress={handleSaveSettings} className="self-start">
          <Text>Simpan Perubahan Pengaturan</Text>
        </Button>
      ) : null}
    </View>
  );
}

