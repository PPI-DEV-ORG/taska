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

interface MasterJenisKunjunganViewProps {
  data: any;
  user: any;
  onBack: () => void;
  addRow: (module: string, payload: any) => void;
  toast: (msg: string, type?: "success" | "danger" | "info" | "warning") => void;
  renderActions?: (row: any) => React.ReactNode;
}

export function MasterJenisKunjunganView({
  data,
  user,
  onBack,
  addRow,
  toast,
  renderActions,
}: MasterJenisKunjunganViewProps) {
  const [open, setOpen] = React.useState(false);
  const [nama, setNama] = React.useState("");

  const isSuper = user?.role === "super_admin";
  const canAdd = isSuper || user?.role === "sales" || user?.role === "bos" || user?.role === "admin" || user?.role === "pm";

  function handleSave() {
    if (!nama.trim()) {
      toast("Nama jenis aktivitas kunjungan wajib diisi", "danger");
      return;
    }
    addRow("visit-activity-types", {
      name: nama.trim(),
      status: "AKTIF",
    });
    setOpen(false);
    setNama("");
    toast("Jenis aktivitas kunjungan berhasil ditambahkan", "success");
  }

  const items = data["visit-activity-types"] ?? [];

  return (
    <View className="gap-5">
      <PageHeader
        back
        title="Jenis Aktivitas Kunjungan & Meeting"
        subtitle={`${items.length || 0} kategori aktivitas operasional lapangan`}
        action={
          <View className="flex-row gap-2">
            <Button variant="outline" size="sm" onPress={onBack}>
              <ArrowLeft size={15} color={colors.text} />
              <Text className="text-xs">Kembali</Text>
            </Button>
            {canAdd && (
              <Button size="sm" onPress={() => setOpen(true)}>
                <Plus size={15} color="#fff" />
                <Text className="text-xs text-white">Tambah Jenis Aktivitas</Text>
              </Button>
            )}
          </View>
        }
      />

      <DataTable
        columns={[
          { key: "name", label: "Nama Aktivitas", primary: true, flex: 2 },
          { key: "status", label: "Status", fmt: "status", flex: 1 },
        ]}
        rows={items.map((i: any) => ({
          ...i,
          id: String(i.id || ""),
          name: i.nama || i.name || "-",
          status: i.status || "AKTIF",
        }))}
        pageSize={8}
        renderActions={renderActions}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Jenis Aktivitas Kunjungan</DialogTitle>
          </DialogHeader>
          <View className="gap-4 py-4">
            <FormField label="Nama Aktivitas" required>
              <Input
                value={nama}
                onChangeText={setNama}
                placeholder="Contoh: Site Inspection, Trial & POC, Demo Lapangan"
              />
            </FormField>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSave}>
              <Text className="text-white">Simpan</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}

