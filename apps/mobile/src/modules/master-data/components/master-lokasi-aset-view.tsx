import * as React from "react";
import { View } from "react-native";
import { ArrowLeft, Plus, MapPin, Trash2, Edit } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader, FormField } from "@/components/akuntra/basics";
import { DataTable } from "@/components/akuntra/data-table";
import { ConfirmDialog } from "@/components/akuntra/dialogs";
import { colors } from "@/tokens";
import { api } from "@/services/api";
import type { FaLocation } from "@/modules/fixed-assets/types";

interface MasterLokasiAsetViewProps {
  user: any;
  onBack: () => void;
  toast: (msg: string, type?: "success" | "danger" | "info" | "warning") => void;
}

export function MasterLokasiAsetView({
  user,
  onBack,
  toast,
}: MasterLokasiAsetViewProps) {
  const [locations, setLocations] = React.useState<FaLocation[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  // Form states
  const [name, setName] = React.useState("");
  const [building, setBuilding] = React.useState("");
  const [floor, setFloor] = React.useState("");
  const [room, setRoom] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [editTarget, setEditTarget] = React.useState<FaLocation | null>(null);

  // Delete target
  const [deleteTarget, setDeleteTarget] = React.useState<FaLocation | null>(null);

  const isSuper = user?.role === "super_admin";
  const roleLower = String(user?.role || "").toLowerCase();
  const canManage =
    isSuper ||
    ["admin", "finance", "bos", "gudang", "procurement", "pm", "director"].includes(roleLower);

  const handleOpenCreate = () => {
    setEditTarget(null);
    setName("");
    setBuilding("");
    setFloor("");
    setRoom("");
    setDescription("");
    setOpen(true);
  };

  const handleOpenEdit = (loc: FaLocation) => {
    setEditTarget(loc);
    setName(loc.name);
    setBuilding(loc.building || "");
    setFloor(loc.floor || "");
    setRoom(loc.room || "");
    setDescription(loc.description || "");
    setOpen(true);
  };

  const fetchLocations = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await api<any>("GET", "/fixed-assets/locations");
      const list = Array.isArray(res) ? res : (res?.data || []);
      setLocations(list);
    } catch (err: any) {
      toast(err?.message || "Gagal memuat lokasi aset", "danger");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    let active = true;
    api<any>("GET", "/fixed-assets/locations")
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res) ? res : (res?.data || []);
        setLocations(list);
      })
      .catch((err) => {
        if (!active) return;
        toast(err?.message || "Gagal memuat lokasi aset", "danger");
      });
    return () => {
      active = false;
    };
  }, [toast]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast("Nama lokasi wajib diisi", "danger");
      return;
    }
    try {
      const payload = {
        name: name.trim(),
        building: building.trim() || undefined,
        floor: floor.trim() || undefined,
        room: room.trim() || undefined,
        description: description.trim() || undefined,
      };

      if (editTarget) {
        await api("PUT", `/fixed-assets/locations/${editTarget.id}`, payload);
        toast(`Lokasi "${name}" berhasil diperbarui`, "success");
      } else {
        await api("POST", "/fixed-assets/locations", payload);
        toast("Lokasi penempatan aset berhasil ditambahkan", "success");
      }
      setOpen(false);
      setEditTarget(null);
      setName("");
      setBuilding("");
      setFloor("");
      setRoom("");
      setDescription("");
      fetchLocations();
    } catch (err: any) {
      toast(err?.message || "Gagal menyimpan lokasi", "danger");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api("DELETE", `/fixed-assets/locations/${deleteTarget.id}`);
      toast(`Lokasi "${deleteTarget.name}" berhasil dihapus`, "success");
      setDeleteTarget(null);
      fetchLocations();
    } catch (err: any) {
      toast(err?.message || "Gagal menghapus lokasi aset", "danger");
    }
  };

  const rows = React.useMemo(() => {
    return locations.map((loc) => ({
      id: String(loc.id),
      nama: loc.name,
      code: loc.code,
      gedung: loc.building || "-",
      lantai: loc.floor || "-",
      ruangan: loc.room || "-",
      totalAset: `${loc._count?.assets || 0} unit`,
      deskripsi: loc.description || "-",
      raw: loc,
    }));
  }, [locations]);

  return (
    <View className="gap-5">
      <PageHeader
        back
        title="Master Lokasi & Ruangan Aset"
        subtitle={`${locations.length} titik lokasi & ruangan penempatan inventaris (Dikelola GA & Operasional)`}
        action={
          <View className="flex-row gap-2">
            <Button variant="outline" size="sm" onPress={onBack}>
              <ArrowLeft size={15} color={colors.text} />
              <Text className="text-xs">Kembali</Text>
            </Button>
            {canManage ? (
              <Button size="sm" onPress={handleOpenCreate} className="gap-1.5">
                <Plus size={15} color={colors.background} />
                <Text className="text-xs">Tambah Lokasi</Text>
              </Button>
            ) : null}
          </View>
        }
      />

      <DataTable
        columns={[
          { key: "nama", label: "Nama Lokasi", primary: true, flex: 2 },
          { key: "gedung", label: "Gedung / Area", flex: 1.2 },
          { key: "lantai", label: "Lantai", flex: 0.9 },
          { key: "ruangan", label: "Ruangan", flex: 1.2 },
          { key: "totalAset", label: "Total Aset", flex: 0.9 },
          { key: "deskripsi", label: "Keterangan", flex: 2 },
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

      {/* Dialog Form Tambah/Edit Lokasi */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Lokasi Penempatan Aset" : "Tambah Lokasi Penempatan Baru"}</DialogTitle>
          </DialogHeader>

          <View className="gap-4 py-2">
            <FormField label="Nama Lokasi Penempatan" required>
              <Input
                value={name}
                onChangeText={setName}
                placeholder="Contoh: Server Room Lantai 2 / Workshop Teknisi"
              />
            </FormField>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <FormField label="Gedung / Area">
                  <Input
                    value={building}
                    onChangeText={setBuilding}
                    placeholder="Contoh: Gedung Kantor Pusat"
                  />
                </FormField>
              </View>

              <View className="w-28">
                <FormField label="Lantai">
                  <Input
                    value={floor}
                    onChangeText={setFloor}
                    placeholder="Contoh: Lt. 2"
                  />
                </FormField>
              </View>

              <View className="flex-1">
                <FormField label="Nomor / Nama Ruangan">
                  <Input
                    value={room}
                    onChangeText={setRoom}
                    placeholder="Contoh: R. Server 203"
                  />
                </FormField>
              </View>
            </View>

            <FormField label="Deskripsi / Catatan Lokasi">
              <Input
                value={description}
                onChangeText={setDescription}
                placeholder="Akses kunci, penanggung jawab ruangan, dll..."
              />
            </FormField>
          </View>

          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onPress={() => setOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button variant="default" onPress={handleSave}>
              <Text>{editTarget ? "Simpan Perubahan" : "Simpan Lokasi"}</Text>
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
        title="Hapus Lokasi Penempatan Aset"
        description={`Apakah Anda yakin ingin menghapus lokasi "${deleteTarget?.name}"? Lokasi hanya dapat dihapus jika tidak memiliki aset yang sedang ditempatkan di sana.`}
        confirmLabel="Hapus Lokasi"
        destructive
        onConfirm={handleDelete}
      />
    </View>
  );
}
