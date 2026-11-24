import * as React from "react";
import { View } from "react-native";
import { ArrowLeft, Plus, FolderKanban, Trash2, Edit } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader, FormField } from "@/components/akuntra/basics";
import { DataTable } from "@/components/akuntra/data-table";
import { SearchableSelect } from "@/components/akuntra/dialogs";
import { ConfirmDialog } from "@/components/akuntra/dialogs";
import { colors } from "@/tokens";
import { api } from "@/services/api";
import type { FaCategory } from "@/modules/fixed-assets/types";

interface MasterKategoriAsetViewProps {
  user: any;
  onBack: () => void;
  toast: (msg: string, type?: "success" | "danger" | "info" | "warning") => void;
}

export function MasterKategoriAsetView({
  user,
  onBack,
  toast,
}: MasterKategoriAsetViewProps) {
  const [categories, setCategories] = React.useState<FaCategory[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  // Form states
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<"TANGIBLE" | "INTANGIBLE">("TANGIBLE");
  const [usefulLifeMonths, setUsefulLifeMonths] = React.useState(48);
  const [depMethod, setDepMethod] = React.useState<string>("STRAIGHT_LINE");
  const [residualRate, setResidualRate] = React.useState("0");
  const [assetAcc, setAssetAcc] = React.useState("1504");
  const [accumAcc, setAccumAcc] = React.useState("1592");
  const [expenseAcc, setExpenseAcc] = React.useState("6101");
  const [description, setDescription] = React.useState("");
  const [editTarget, setEditTarget] = React.useState<FaCategory | null>(null);

  // Delete target
  const [deleteTarget, setDeleteTarget] = React.useState<FaCategory | null>(null);

  const isSuper = user?.role === "super_admin";
  const roleLower = String(user?.role || "").toLowerCase();
  const canManage =
    isSuper || ["admin", "finance", "bos", "accounting", "director"].includes(roleLower);

  const handleOpenCreate = () => {
    setEditTarget(null);
    setName("");
    setType("TANGIBLE");
    setUsefulLifeMonths(48);
    setDepMethod("STRAIGHT_LINE");
    setResidualRate("0");
    setAssetAcc("1504");
    setAccumAcc("1592");
    setExpenseAcc("6101");
    setDescription("");
    setOpen(true);
  };

  const handleOpenEdit = (c: FaCategory) => {
    setEditTarget(c);
    setName(c.name);
    setType(c.type as any);
    setUsefulLifeMonths(c.defaultUsefulLifeMonths || 48);
    setDepMethod(c.depreciationMethod || "STRAIGHT_LINE");
    setResidualRate(String(c.defaultResidualRate || 0));
    setAssetAcc(c.assetAccountCode || "1504");
    setAccumAcc(c.accumDepAccountCode || "1592");
    setExpenseAcc(c.depExpenseAccountCode || "6101");
    setDescription(c.description || "");
    setOpen(true);
  };

  const fetchCategories = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await api<any>("GET", "/fixed-assets/categories");
      const list = Array.isArray(res) ? res : (res?.data || []);
      setCategories(list);
    } catch (err: any) {
      toast(err?.message || "Gagal memuat kategori aset", "danger");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    let active = true;
    api<any>("GET", "/fixed-assets/categories")
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res) ? res : (res?.data || []);
        setCategories(list);
      })
      .catch((err) => {
        if (!active) return;
        toast(err?.message || "Gagal memuat kategori aset", "danger");
      });
    return () => {
      active = false;
    };
  }, [toast]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast("Nama kategori wajib diisi", "danger");
      return;
    }
    try {
      const payload = {
        name: name.trim(),
        type,
        defaultUsefulLifeMonths: Number(usefulLifeMonths) || 48,
        depreciationMethod: depMethod,
        defaultResidualRate: Number(residualRate) || 0,
        assetAccountCode: assetAcc.trim() || undefined,
        accumDepAccountCode: accumAcc.trim() || undefined,
        depExpenseAccountCode: expenseAcc.trim() || undefined,
        description: description.trim() || undefined,
      };

      if (editTarget) {
        await api("PUT", `/fixed-assets/categories/${editTarget.id}`, payload);
        toast(`Kategori "${name}" berhasil diperbarui`, "success");
      } else {
        await api("POST", "/fixed-assets/categories", payload);
        toast("Kategori aset tetap berhasil ditambahkan", "success");
      }
      setOpen(false);
      setEditTarget(null);
      setName("");
      setDescription("");
      fetchCategories();
    } catch (err: any) {
      toast(err?.message || "Gagal menyimpan kategori", "danger");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api("DELETE", `/fixed-assets/categories/${deleteTarget.id}`);
      toast(`Kategori "${deleteTarget.name}" berhasil dihapus`, "success");
      setDeleteTarget(null);
      fetchCategories();
    } catch (err: any) {
      toast(err?.message || "Gagal menghapus kategori aset", "danger");
    }
  };

  const rows = React.useMemo(() => {
    return categories.map((c) => {
      const years = Math.round((c.defaultUsefulLifeMonths / 12) * 10) / 10;
      return {
        id: String(c.id),
        nama: c.name,
        code: c.code,
        tipe: c.type === "TANGIBLE" ? "Berwujud" : "Tak Berwujud",
        masaManfaat: `${c.defaultUsefulLifeMonths} Bulan (${years} Thn)`,
        metode:
          c.depreciationMethod === "STRAIGHT_LINE"
            ? "Garis Lurus"
            : c.depreciationMethod === "DECLINING_BALANCE"
            ? "Saldo Menurun"
            : "Tidak Disusutkan",
        akun: `${c.assetAccountCode || "1500"} / ${c.accumDepAccountCode || "1590"} / ${c.depExpenseAccountCode || "6101"}`,
        totalAset: `${c._count?.assets || 0} unit`,
        raw: c,
      };
    });
  }, [categories]);

  return (
    <View className="gap-5">
      <PageHeader
        back
        title="Master Kategori Aset Tetap"
        subtitle={`${categories.length} kategori inventaris & aset tetap perusahaan (Dikelola Finance & Asset Manager)`}
        action={
          <View className="flex-row flex-wrap items-center gap-2 max-w-full">
            <Button variant="outline" size="sm" onPress={onBack}>
              <ArrowLeft size={15} color={colors.text} />
              <Text className="text-xs">Kembali</Text>
            </Button>
            {canManage ? (
              <Button size="sm" onPress={handleOpenCreate} className="gap-1.5">
                <Plus size={15} color={colors.background} />
                <Text className="text-xs">Tambah Kategori</Text>
              </Button>
            ) : null}
          </View>
        }
      />

      <DataTable
        columns={[
          { key: "nama", label: "Nama Kategori", primary: true, flex: 1.8 },
          { key: "tipe", label: "Tipe", flex: 1 },
          { key: "masaManfaat", label: "Masa Manfaat", flex: 1.3 },
          { key: "metode", label: "Metode Depresiasi", flex: 1.2 },
          { key: "akun", label: "Akun COA (Aset/Akum/Beban)", flex: 1.6 },
          { key: "totalAset", label: "Total Aset", flex: 0.9 },
        ]}
        rows={rows}
        pageSize={8}
        actionsWidth={canManage ? 88 : 64}
        renderActions={(row: any) =>
          canManage ? (
            <View className="flex-row items-center gap-1 justify-center">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg hover:bg-muted"
                onPress={() => handleOpenEdit(row.raw)}
              >
                <Edit size={14} color={colors.text} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg hover:bg-danger/10"
                onPress={() => setDeleteTarget(row.raw)}
              >
                <Trash2 size={14} color={colors.danger} />
              </Button>
            </View>
          ) : null
        }
      />

      {/* Dialog Form Tambah/Edit Kategori */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Edit Kategori Aset Tetap" : "Tambah Kategori Aset Tetap Baru"}
            </DialogTitle>
          </DialogHeader>

          <View className="gap-4 py-2">
            <FormField label="Nama Kategori Aset" required>
              <Input
                value={name}
                onChangeText={setName}
                placeholder="Contoh: Server, Kendaraan Operasional, Mesin Pabrik"
              />
            </FormField>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <FormField label="Tipe Aset" required>
                  <SearchableSelect
                    value={type === "TANGIBLE" ? "Berwujud (Tangible)" : "Tak Berwujud (Intangible)"}
                    options={["Berwujud (Tangible)", "Tak Berwujud (Intangible)"]}
                    onChange={(v) => setType(v.includes("Tak") ? "INTANGIBLE" : "TANGIBLE")}
                  />
                </FormField>
              </View>

              <View className="flex-1">
                <FormField label="Masa Manfaat (Bulan)" required>
                  <Input
                    value={String(usefulLifeMonths)}
                    onChangeText={(v) => setUsefulLifeMonths(Number(v.replace(/\D/g, "")) || 0)}
                    keyboardType="numeric"
                    placeholder="48"
                  />
                </FormField>
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <FormField label="Metode Depresiasi" required>
                  <SearchableSelect
                    value={
                      depMethod === "STRAIGHT_LINE"
                        ? "Garis Lurus (Straight Line)"
                        : depMethod === "DECLINING_BALANCE"
                        ? "Saldo Menurun (Declining)"
                        : "Tidak Disusutkan (Tanah)"
                    }
                    options={[
                      "Garis Lurus (Straight Line)",
                      "Saldo Menurun (Declining)",
                      "Tidak Disusutkan (Tanah)",
                    ]}
                    onChange={(v) => {
                      if (v.includes("Lurus")) setDepMethod("STRAIGHT_LINE");
                      else if (v.includes("Menurun")) setDepMethod("DECLINING_BALANCE");
                      else setDepMethod("NONE");
                    }}
                  />
                </FormField>
              </View>

              <View className="flex-1">
                <FormField label="Default Nilai Residu (%)">
                  <Input
                    value={residualRate}
                    onChangeText={setResidualRate}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </FormField>
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <FormField label="Akun Aset (COA)">
                  <Input
                    value={assetAcc}
                    onChangeText={setAssetAcc}
                    placeholder="1504 (Peralatan Kantor)"
                  />
                </FormField>
              </View>

              <View className="flex-1">
                <FormField label="Akun Akum. Depresiasi">
                  <Input
                    value={accumAcc}
                    onChangeText={setAccumAcc}
                    placeholder="1592 (Akum. Peralatan)"
                  />
                </FormField>
              </View>

              <View className="flex-1">
                <FormField label="Akun Beban Depresiasi">
                  <Input
                    value={expenseAcc}
                    onChangeText={setExpenseAcc}
                    placeholder="6101 (Beban Depresiasi)"
                  />
                </FormField>
              </View>
            </View>

            <FormField label="Deskripsi / Keterangan Kategori">
              <Input
                value={description}
                onChangeText={setDescription}
                placeholder="Spesifikasi atau cakupan aset dalam kategori ini..."
              />
            </FormField>
          </View>

          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onPress={() => setOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button variant="default" onPress={handleSave}>
              <Text>{editTarget ? "Simpan Perubahan" : "Simpan Kategori"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi Hapus */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
        title="Hapus Kategori Aset Tetap"
        description={`Apakah Anda yakin ingin menghapus kategori "${deleteTarget?.name}"? Tindakan ini tidak dapat dibatalkan jika kategori belum memiliki aset terdaftar.`}
        confirmLabel="Hapus Kategori"
        destructive
        onConfirm={handleDelete}
      />
    </View>
  );
}
