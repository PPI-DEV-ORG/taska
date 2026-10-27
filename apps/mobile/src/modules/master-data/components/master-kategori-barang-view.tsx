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

interface MasterKategoriBarangViewProps {
  data: any;
  user: any;
  onBack: () => void;
  addRow: (module: string, payload: any) => void;
  toast: (msg: string, type?: "success" | "danger" | "info" | "warning") => void;
  renderActions?: (row: any) => React.ReactNode;
}

export function MasterKategoriBarangView({
  data,
  user,
  onBack,
  addRow,
  toast,
  renderActions,
}: MasterKategoriBarangViewProps) {
  const [kategoriOpen, setKategoriOpen] = React.useState(false);
  const [kategoriNama, setKategoriNama] = React.useState("");
  const [kategoriDesc, setKategoriDesc] = React.useState("");

  const isSuper = user?.role === "super_admin";
  const canAddKategori = isSuper || user?.role === "gudang" || user?.role === "bos" || user?.role === "admin" || user?.role === "procurement";

  function handleSaveKategori() {
    if (!kategoriNama.trim()) {
      toast("Nama kategori wajib diisi", "danger");
      return;
    }
    addRow("productCategories", {
      nama: kategoriNama.trim(),
      deskripsi: kategoriDesc.trim() || "-",
      status: "Aktif",
    });
    setKategoriOpen(false);
    setKategoriNama("");
    setKategoriDesc("");
    toast("Kategori produk berhasil ditambahkan");
  }

  return (
    <View className="gap-5">
      <PageHeader
        back
        title="Master Kategori Produk"
        subtitle={`${data.productCategories?.length || 0} kelompok kategori barang (Dikelola Gudang & Procurement)`}
        action={
          <View className="flex-row gap-2">
            <Button variant="outline" size="sm" onPress={onBack}>
              <ArrowLeft size={15} color={colors.text} />
              <Text className="text-xs">Kembali</Text>
            </Button>
            {canAddKategori ? (
              <Button size="sm" onPress={() => setKategoriOpen(true)}>
                <Plus size={15} color={colors.background} />
                <Text className="text-xs">Tambah Kategori</Text>
              </Button>
            ) : null}
          </View>
        }
      />
      <DataTable
        columns={[
          { key: "nama", label: "Nama Kategori", primary: true, flex: 2 },
          { key: "deskripsi", label: "Deskripsi", flex: 3 },
          { key: "status", label: "Status", fmt: "status", flex: 0.8 },
        ]}
        rows={data.productCategories || []}
        pageSize={8}
        actionsWidth={canAddKategori ? 72 : 64}
        renderActions={renderActions}
      />

      <Dialog open={kategoriOpen} onOpenChange={setKategoriOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tambah Kategori Produk Baru</DialogTitle>
          </DialogHeader>
          <View className="gap-4">
            <FormField label="Nama Kategori Produk" required>
              <Input
                value={kategoriNama}
                onChangeText={setKategoriNama}
                placeholder="Contoh: Sensor IoT & Smart Home"
              />
            </FormField>
            <FormField label="Deskripsi / Ruang Lingkup">
              <Input
                value={kategoriDesc}
                onChangeText={setKategoriDesc}
                placeholder="Keterangan singkat kelompok produk ini"
              />
            </FormField>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setKategoriOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveKategori}>
              <Text>Simpan Kategori</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}

