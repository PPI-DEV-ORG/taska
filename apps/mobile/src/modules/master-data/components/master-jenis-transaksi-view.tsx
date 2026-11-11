import * as React from "react";
import { View } from "react-native";
import { ArrowLeft, Plus } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader, FormField } from "@/components/taska/basics";
import { DataTable } from "@/components/taska/data-table";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";

interface MasterJenisTransaksiViewProps {
  data: any;
  user: any;
  onBack: () => void;
  addRow: (module: string, payload: any) => void;
  toast: (msg: string, type?: "success" | "danger" | "info" | "warning") => void;
  renderActions?: (row: any) => React.ReactNode;
}

export function MasterJenisTransaksiView({
  data,
  user,
  onBack,
  addRow,
  toast,
  renderActions,
}: MasterJenisTransaksiViewProps) {
  const [open, setOpen] = React.useState(false);
  const [nama, setNama] = React.useState("");
  const { refreshModule } = useApp();

  React.useEffect(() => {
    if (refreshModule && (!data.dealTypes || data.dealTypes.length === 0)) {
      void refreshModule("dealTypes");
    }
  }, [refreshModule, data.dealTypes]);

  const isSuper = user?.role === "super_admin";
  const canAdd = isSuper || user?.role === "sales" || user?.role === "bos" || user?.role === "admin";

  function handleSave() {
    if (!nama.trim()) {
      toast("Nama jenis transaksi wajib diisi", "danger");
      return;
    }
    addRow("dealTypes", {
      nama: nama.trim(),
      status: "Aktif",
    });
    setOpen(false);
    setNama("");
    toast("Jenis transaksi / peluang berhasil ditambahkan");
  }

  const defaultItems = React.useMemo(() => [
    { id: "1", nama: "Proyek (Instalasi & Jasa)", status: "Aktif" },
    { id: "2", nama: "Penjualan Barang (Perangkat / Retail)", status: "Aktif" },
  ], []);

  const items = (data.dealTypes && data.dealTypes.length > 0) ? data.dealTypes : defaultItems;

  return (
    <View className="gap-5">
      <PageHeader
        back
        title="Jenis Transaksi / Peluang Lead"
        subtitle={`${items.length || 0} kategori kesepakatan bisnis (Dikelola Sales)`}
        action={
          <View className="flex-row gap-2">
            <Button variant="outline" size="sm" onPress={onBack}>
              <ArrowLeft size={15} color={colors.text} />
              <Text className="text-xs">Kembali</Text>
            </Button>
            {canAdd ? (
              <Button size="sm" onPress={() => setOpen(true)}>
                <Plus size={15} color={colors.background} />
                <Text className="text-xs">Tambah Jenis Transaksi</Text>
              </Button>
            ) : null}
          </View>
        }
      />
      <DataTable
        columns={[
          { key: "nama", label: "Jenis Transaksi / Peluang", primary: true, flex: 2 },
          { key: "status", label: "Status", fmt: "status", flex: 1 },
        ]}
        rows={items}
        pageSize={8}
        actionsWidth={canAdd ? 72 : 64}
        renderActions={renderActions}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tambah Jenis Transaksi / Peluang</DialogTitle>
          </DialogHeader>
          <View className="gap-4">
            <FormField label="Nama Jenis Transaksi / Peluang" required>
              <Input
                value={nama}
                onChangeText={setNama}
                placeholder="Contoh: Jasa Pemeliharaan / AMC, Sewa Perangkat, Pengadaan IT"
              />
            </FormField>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSave}>
              <Text>Simpan Jenis Transaksi</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}
