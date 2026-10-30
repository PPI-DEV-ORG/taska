import * as React from "react";
import { View } from "react-native";
import { Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/taska/dialogs";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import type { MasterKey, DeleteTarget } from "@/modules/master-data/types";
import { MasterCategoriesGrid } from "@/modules/master-data/components/master-categories-grid";
import { MasterImportDialog } from "@/modules/master-data/components/master-import-dialog";
import { MasterBarangView } from "@/modules/master-data/components/master-barang-view";
import { MasterKategoriBarangView } from "@/modules/master-data/components/master-kategori-barang-view";
import { MasterGudangView } from "@/modules/master-data/components/master-gudang-view";
import { MasterSumberLeadView } from "@/modules/master-data/components/master-sumber-lead-view";
import { MasterAlasanLostView } from "@/modules/master-data/components/master-alasan-lost-view";
import { MasterJenisKunjunganView } from "@/modules/master-data/components/master-jenis-kunjungan-view";
import { MasterKategoriPengeluaranView } from "@/modules/master-data/components/master-kategori-pengeluaran-view";
import { MasterCostCenterView } from "@/modules/master-data/components/master-cost-center-view";
import { MasterPengaturanSistemView } from "@/modules/master-data/components/master-pengaturan-sistem-view";

export default function MasterDataScreen() {
  const { data, user, addRow, patchRow, deleteRow, toast, reload, refreshModule } = useApp();
  const [selectedCategory, setSelectedCategory] = React.useState<MasterKey | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<DeleteTarget | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);

  const hasFetchedRef = React.useRef(false);
  React.useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      if (refreshModule) {
        void Promise.all([
          refreshModule("productCategories"),
          refreshModule("products"),
          refreshModule("suppliers"),
          refreshModule("warehouses"),
          refreshModule("leadSources"),
          refreshModule("lostReasons"),
          refreshModule("expenseCategories"),
          refreshModule("costCenters"),
          refreshModule("customers"),
        ]);
      }
    }
  }, [refreshModule]);

  const isSuper = user?.role === "super_admin";
  const canAddKategori = isSuper || user?.role === "gudang" || user?.role === "bos" || user?.role === "admin" || user?.role === "procurement";
  const canAddBarang = isSuper || user?.role === "gudang" || user?.role === "bos" || user?.role === "admin" || user?.role === "procurement";
  const canAddGudang = isSuper || user?.role === "procurement" || user?.role === "bos" || user?.role === "admin";
  const canAddLeadSource = isSuper || user?.role === "sales" || user?.role === "bos" || user?.role === "admin";
  const canAddLostReason = isSuper || user?.role === "sales" || user?.role === "bos" || user?.role === "admin";
  const canAddExpenseCat = isSuper || user?.role === "finance" || user?.role === "bos" || user?.role === "admin";
  const canAddCostCenter = isSuper || user?.role === "finance" || user?.role === "bos" || user?.role === "admin";

  function deleteActions(module: string, singular: string, canDelete: boolean) {
    if (!canDelete) return undefined;
    const render = (row: any) => (
      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-lg hover:bg-danger/10"
        onPress={() => setDeleteTarget({
          module,
          id: String(row.id),
          label: String(row.nama ?? row.name ?? row.sku ?? row.nomor ?? row.id),
          singular,
        })}
      >
        <Trash2 size={15} color={colors.danger} />
      </Button>
    );
    render.displayName = `Delete${module}`;
    return render;
  }

  const deleteConfirm = (
    <ConfirmDialog
      open={!!deleteTarget}
      onOpenChange={(v) => !v && setDeleteTarget(null)}
      title={`Hapus ${deleteTarget?.singular ?? "data"} ini?`}
      description={`Data "${deleteTarget?.label ?? ""}" akan dihapus setelah kamu mengonfirmasi. Server tetap memvalidasi apakah data ini boleh dihapus.`}
      confirmLabel="Ya, hapus"
      destructive
      onConfirm={() => {
        if (!deleteTarget) return;
        void deleteRow(deleteTarget.module, deleteTarget.id).then((ok) => {
          if (ok) setDeleteTarget(null);
        });
      }}
    />
  );

  return (
    <View className="gap-5">
      {selectedCategory === null && (
        <MasterCategoriesGrid
          data={data}
          user={user}
          onSelectCategory={(cat) => setSelectedCategory(cat)}
          onOpenImport={() => setImportOpen(true)}
        />
      )}

      {selectedCategory === "barang" && (
        <MasterBarangView
          data={data}
          user={user}
          onBack={() => setSelectedCategory(null)}
          onSelectCategory={(cat) => setSelectedCategory(cat)}
          addRow={addRow}
          patchRow={(module, id, payload) => patchRow(module, String(id), payload)}
          toast={toast}
          renderActions={deleteActions("products", "barang", canAddBarang)}
        />
      )}

      {selectedCategory === "kategori-barang" && (
        <MasterKategoriBarangView
          data={data}
          user={user}
          onBack={() => setSelectedCategory(null)}
          addRow={addRow}
          toast={toast}
          renderActions={deleteActions("productCategories", "kategori produk", canAddKategori)}
        />
      )}

      {selectedCategory === "gudang" && (
        <MasterGudangView
          data={data}
          user={user}
          onBack={() => setSelectedCategory(null)}
          addRow={addRow}
          toast={toast}
          renderActions={deleteActions("warehouses", "gudang", canAddGudang)}
        />
      )}

      {selectedCategory === "sumber-lead" && (
        <MasterSumberLeadView
          data={data}
          user={user}
          onBack={() => setSelectedCategory(null)}
          addRow={addRow}
          toast={toast}
          renderActions={deleteActions("leadSources", "sumber lead", canAddLeadSource)}
        />
      )}

      {selectedCategory === "alasan-lost" && (
        <MasterAlasanLostView
          data={data}
          user={user}
          onBack={() => setSelectedCategory(null)}
          addRow={addRow}
          toast={toast}
          renderActions={deleteActions("lostReasons", "alasan Lost", canAddLostReason)}
        />
      )}

      {selectedCategory === "jenis-kunjungan" && (
        <MasterJenisKunjunganView
          data={data}
          user={user}
          onBack={() => setSelectedCategory(null)}
          addRow={addRow}
          toast={toast}
          renderActions={deleteActions("visit-activity-types", "jenis aktivitas", canAddLeadSource)}
        />
      )}

      {selectedCategory === "kategori-pengeluaran" && (
        <MasterKategoriPengeluaranView
          data={data}
          user={user}
          onBack={() => setSelectedCategory(null)}
          addRow={addRow}
          toast={toast}
          renderActions={deleteActions("expenseCategories", "kategori pengeluaran", canAddExpenseCat)}
        />
      )}

      {selectedCategory === "cost-center" && (
        <MasterCostCenterView
          data={data}
          user={user}
          onBack={() => setSelectedCategory(null)}
          addRow={addRow}
          toast={toast}
          renderActions={deleteActions("costCenters", "cost center", canAddCostCenter)}
        />
      )}

      {selectedCategory === "pengaturan-sistem" && (
        <MasterPengaturanSistemView
          user={user}
          onBack={() => setSelectedCategory(null)}
          toast={toast}
        />
      )}

      <MasterImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={reload}
        toast={toast}
      />

      {deleteConfirm}
    </View>
  );
}
