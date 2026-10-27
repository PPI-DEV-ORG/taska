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

interface MasterGudangViewProps {
  data: any;
  user: any;
  onBack: () => void;
  addRow: (module: string, payload: any) => void;
  toast: (msg: string, type?: "success" | "danger" | "info" | "warning") => void;
  renderActions?: (row: any) => React.ReactNode;
}

export function MasterGudangView({
  data,
  user,
  onBack,
  addRow,
  toast,
  renderActions,
}: MasterGudangViewProps) {
  const [gudangOpen, setGudangOpen] = React.useState(false);
  const [gudangNama, setGudangNama] = React.useState("");
  const [gudangKota, setGudangKota] = React.useState("");
  const [gudangStaf, setGudangStaf] = React.useState("");

  const isSuper = user?.role === "super_admin";
  const canAddGudang = isSuper || user?.role === "procurement" || user?.role === "bos" || user?.role === "admin";

  function handleSaveGudang() {
    if (!gudangNama.trim() || !gudangKota.trim()) {
      toast("Nama gudang dan kota wajib diisi", "danger");
      return;
    }
    addRow("warehouses", {
      nama: gudangNama,
      kota: gudangKota,
      staf: gudangStaf.trim() || "Belum ditugaskan",
      status: "Aktif",
    });
    setGudangOpen(false);
    setGudangNama("");
    setGudangKota("");
    setGudangStaf("");
    toast("Master gudang berhasil ditambahkan");
  }

  return (
    <View className="gap-5">
      <PageHeader
        back
        title="Daftar Gudang Perusahaan"
        subtitle={`${data.warehouses?.length || 0} lokasi gudang operasional (Dikelola Procurement)`}
        action={
          <View className="flex-row gap-2">
            <Button variant="outline" size="sm" onPress={onBack}>
              <ArrowLeft size={15} color={colors.text} />
              <Text className="text-xs">Kembali</Text>
            </Button>
            {canAddGudang ? (
              <Button size="sm" onPress={() => setGudangOpen(true)}>
                <Plus size={15} color={colors.background} />
                <Text className="text-xs">Tambah Gudang</Text>
              </Button>
            ) : null}
          </View>
        }
      />
      <DataTable
        columns={[
          { key: "nama", label: "Nama Gudang", primary: true, flex: 1.6 },
          { key: "kota", label: "Lokasi Kota", flex: 1.2 },
          { key: "staf", label: "Staf Penanggung Jawab", flex: 1.5 },
          { key: "status", label: "Status Operasional", fmt: "status", flex: 1 },
        ]}
        rows={data.warehouses || []}
        pageSize={8}
        actionsWidth={canAddGudang ? 72 : 64}
        renderActions={renderActions}
      />

      <Dialog open={gudangOpen} onOpenChange={setGudangOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tambah Gudang Operasional</DialogTitle>
          </DialogHeader>
          <View className="gap-4">
            <FormField label="Nama Gudang" required>
              <Input
                value={gudangNama}
                onChangeText={setGudangNama}
                placeholder="Contoh: Gudang Transit Bandung"
              />
            </FormField>
            <FormField label="Lokasi Kota" required>
              <Input
                value={gudangKota}
                onChangeText={setGudangKota}
                placeholder="Contoh: Bandung"
              />
            </FormField>
            <FormField label="Staf Penanggung Jawab">
              <Input
                value={gudangStaf}
                onChangeText={setGudangStaf}
                placeholder="Nama staf gudang (opsional)"
              />
            </FormField>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setGudangOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveGudang}>
              <Text>Simpan Gudang</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}

