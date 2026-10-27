import * as React from "react";
import { View } from "react-native";
import { ArrowLeft, Plus } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader, FormField } from "@/components/taska/basics";
import { DataTable } from "@/components/taska/data-table";
import { colors } from "@/tokens";

interface MasterCostCenterViewProps {
  data: any;
  user: any;
  onBack: () => void;
  addRow: (module: string, payload: any) => void;
  toast: (msg: string, type?: "success" | "danger" | "info" | "warning") => void;
  renderActions?: (row: any) => React.ReactNode;
}

export function MasterCostCenterView({
  data,
  user,
  onBack,
  addRow,
  toast,
  renderActions,
}: MasterCostCenterViewProps) {
  const [costCenterOpen, setCostCenterOpen] = React.useState(false);
  const [costCenterNama, setCostCenterNama] = React.useState("");
  const [costCenterKode, setCostCenterKode] = React.useState("");

  const isSuper = user?.role === "super_admin";
  const canAddCostCenter = isSuper || user?.role === "finance" || user?.role === "bos" || user?.role === "admin";

  function handleSaveCostCenter() {
    if (!costCenterNama.trim()) {
      toast("Nama cost center wajib diisi", "danger");
      return;
    }
    addRow("costCenters", {
      nama: `${costCenterKode.trim() ? costCenterKode.trim() + " - " : ""}${costCenterNama.trim()}`,
      status: "Aktif",
    });
    setCostCenterOpen(false);
    setCostCenterNama("");
    setCostCenterKode("");
    toast("Cost center berhasil ditambahkan");
  }

  return (
    <View className="gap-5">
      <PageHeader
        back
        title="Master Cost Center (Pusat Biaya)"
        subtitle={`${data.costCenters?.length || 0} pusat pembebanan anggaran (Dikelola Finance)`}
        action={
          <View className="flex-row gap-2">
            <Button variant="outline" size="sm" onPress={onBack}>
              <ArrowLeft size={15} color={colors.text} />
              <Text className="text-xs">Kembali</Text>
            </Button>
            {canAddCostCenter ? (
              <Button size="sm" onPress={() => setCostCenterOpen(true)}>
                <Plus size={15} color={colors.background} />
                <Text className="text-xs">Tambah Cost Center</Text>
              </Button>
            ) : null}
          </View>
        }
      />
      <DataTable
        columns={[
          { key: "nama", label: "Kode & Nama Cost Center", primary: true, flex: 2 },
          { key: "status", label: "Status", fmt: "status", flex: 1 },
        ]}
        rows={data.costCenters || []}
        pageSize={8}
        actionsWidth={canAddCostCenter ? 72 : 64}
        renderActions={renderActions}
      />

      <Dialog open={costCenterOpen} onOpenChange={setCostCenterOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tambah Cost Center</DialogTitle>
          </DialogHeader>
          <View className="gap-4">
            <FormField label="Kode Cost Center (Singkatan)">
              <Input
                value={costCenterKode}
                onChangeText={setCostCenterKode}
                placeholder="Contoh: CC-RND"
              />
            </FormField>
            <FormField label="Nama Departemen / Beban" required>
              <Input
                value={costCenterNama}
                onChangeText={setCostCenterNama}
                placeholder="Contoh: Riset & Pengembangan Produk"
              />
            </FormField>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setCostCenterOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveCostCenter}>
              <Text>Simpan Cost Center</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}

