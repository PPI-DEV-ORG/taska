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

interface MasterKategoriPengeluaranViewProps {
  data: any;
  user: any;
  onBack: () => void;
  addRow: (module: string, payload: any) => void;
  toast: (msg: string, type?: "success" | "danger" | "info" | "warning") => void;
  renderActions?: (row: any) => React.ReactNode;
}

export function MasterKategoriPengeluaranView({
  data,
  user,
  onBack,
  addRow,
  toast,
  renderActions,
}: MasterKategoriPengeluaranViewProps) {
  const [expenseCatOpen, setExpenseCatOpen] = React.useState(false);
  const [expenseCatNama, setExpenseCatNama] = React.useState("");

  const isSuper = user?.role === "super_admin";
  const canAddExpenseCat = isSuper || user?.role === "finance" || user?.role === "bos" || user?.role === "admin";

  function handleSaveExpenseCat() {
    if (!expenseCatNama.trim()) {
      toast("Nama kategori pengeluaran wajib diisi", "danger");
      return;
    }
    addRow("expenseCategories", { nama: expenseCatNama.trim(), status: "Aktif" });
    setExpenseCatOpen(false);
    setExpenseCatNama("");
    toast("Kategori pengeluaran berhasil ditambahkan");
  }

  return (
    <View className="gap-5">
      <PageHeader
        back
        title="Master Kategori Pengeluaran & Biaya"
        subtitle={`${data.expenseCategories?.length || 0} pos biaya operasional (Dikelola Finance)`}
        action={
          <View className="flex-row gap-2">
            <Button variant="outline" size="sm" onPress={onBack}>
              <ArrowLeft size={15} color={colors.text} />
              <Text className="text-xs">Kembali</Text>
            </Button>
            {canAddExpenseCat ? (
              <Button size="sm" onPress={() => setExpenseCatOpen(true)}>
                <Plus size={15} color={colors.background} />
                <Text className="text-xs">Tambah Kategori Biaya</Text>
              </Button>
            ) : null}
          </View>
        }
      />
      <DataTable
        columns={[
          { key: "nama", label: "Pos Kategori Biaya", primary: true, flex: 2 },
          { key: "status", label: "Status", fmt: "status", flex: 1 },
        ]}
        rows={data.expenseCategories || []}
        pageSize={8}
        actionsWidth={canAddExpenseCat ? 72 : 64}
        renderActions={renderActions}
      />

      <Dialog open={expenseCatOpen} onOpenChange={setExpenseCatOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tambah Kategori Pengeluaran</DialogTitle>
          </DialogHeader>
          <View className="gap-4">
            <FormField label="Nama Kategori Biaya" required>
              <Input
                value={expenseCatNama}
                onChangeText={setExpenseCatNama}
                placeholder="Contoh: Tiket Pesawat & Perjalanan Jauh"
              />
            </FormField>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setExpenseCatOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveExpenseCat}>
              <Text>Simpan Kategori</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}

