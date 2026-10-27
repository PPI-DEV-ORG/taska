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

interface MasterAlasanLostViewProps {
  data: any;
  user: any;
  onBack: () => void;
  addRow: (module: string, payload: any) => void;
  toast: (msg: string, type?: "success" | "danger" | "info" | "warning") => void;
  renderActions?: (row: any) => React.ReactNode;
}

export function MasterAlasanLostView({
  data,
  user,
  onBack,
  addRow,
  toast,
  renderActions,
}: MasterAlasanLostViewProps) {
  const [lostReasonOpen, setLostReasonOpen] = React.useState(false);
  const [lostReasonNama, setLostReasonNama] = React.useState("");

  const isSuper = user?.role === "super_admin";
  const canAddLostReason = isSuper || user?.role === "sales" || user?.role === "bos" || user?.role === "admin";

  function handleSaveLostReason() {
    if (!lostReasonNama.trim()) {
      toast("Alasan Lost wajib diisi", "danger");
      return;
    }
    addRow("lostReasons", { nama: lostReasonNama.trim(), status: "Aktif" });
    setLostReasonOpen(false);
    setLostReasonNama("");
    toast("Master alasan Lost berhasil ditambahkan");
  }

  return (
    <View className="gap-5">
      <PageHeader
        back
        title="Master Alasan Lost (Gagal Deal)"
        subtitle={`${data.lostReasons?.length || 0} alasan rujukan saat lead gagal (Dikelola Sales)`}
        action={
          <View className="flex-row gap-2">
            <Button variant="outline" size="sm" onPress={onBack}>
              <ArrowLeft size={15} color={colors.text} />
              <Text className="text-xs">Kembali</Text>
            </Button>
            {canAddLostReason ? (
              <Button size="sm" onPress={() => setLostReasonOpen(true)}>
                <Plus size={15} color={colors.background} />
                <Text className="text-xs">Tambah Alasan Lost</Text>
              </Button>
            ) : null}
          </View>
        }
      />
      <DataTable
        columns={[
          { key: "nama", label: "Alasan Lost / Pembatalan", primary: true, flex: 2 },
          { key: "status", label: "Status", fmt: "status", flex: 1 },
        ]}
        rows={data.lostReasons || []}
        pageSize={8}
        actionsWidth={canAddLostReason ? 72 : 64}
        renderActions={renderActions}
      />

      <Dialog open={lostReasonOpen} onOpenChange={setLostReasonOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tambah Master Alasan Lost</DialogTitle>
          </DialogHeader>
          <View className="gap-4">
            <FormField label="Nama Alasan Lost / Batal" required>
              <Input
                value={lostReasonNama}
                onChangeText={setLostReasonNama}
                placeholder="Contoh: Anggaran Klien Dipangkas"
              />
            </FormField>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setLostReasonOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveLostReason}>
              <Text>Simpan Alasan</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}

