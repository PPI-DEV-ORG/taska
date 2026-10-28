import * as React from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { DatePicker, SearchableSelect } from "@/components/taska/dialogs";
import { useApp } from "@/store/app-store";
import { tanggal } from "@/lib/format";
import { type Row } from "@/constants/modules";

const STATUSES = ["TODO", "IN PROGRESS", "PENDING", "TESTED", "DONE", "REJECTED", "BLOCKED"];

/** Detail + edit task. Klik "Edit" untuk mengubah nama, deskripsi, PIC, tenggat, status. */
export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
}: {
  task: Row | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data, patchRow, toast } = useApp();
  const [prevKey, setPrevKey] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [nama, setNama] = React.useState("");
  const [deskripsi, setDeskripsi] = React.useState("");
  const [pic, setPic] = React.useState("");
  const [tenggat, setTenggat] = React.useState("");
  const [status, setStatus] = React.useState("TODO");

  const currentKey = open && task ? `${task.id}-${open}` : null;
  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    if (task && open) {
      setEditing(false);
      setNama(String(task.nama ?? ""));
      setDeskripsi(String(task.deskripsi ?? ""));
      setPic(String(task.pic ?? ""));
      setTenggat(String(task.tenggat ?? ""));
      setStatus(String(task.status ?? "TODO"));
    }
  }

  if (!task) return null;

  const userNames = (data.users ?? []).map((u: any) => String(u.name || u.nama || "")).filter(Boolean);
  const subTasks = (data.tasks ?? []).filter((t: Row) => String(t.parentId ?? "") === String(task.id));

  async function save() {
    if (!nama.trim()) {
      toast("Nama tugas wajib diisi", "danger");
      return;
    }
    setSaving(true);
    try {
      await patchRow("tasks", task!.id, {
        nama: nama.trim(),
        deskripsi: deskripsi.trim(),
        pic,
        tenggat: tenggat || undefined,
        status,
      });
      toast("Tugas berhasil diperbarui");
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Tugas" : "Detail Tugas"}</DialogTitle>
        </DialogHeader>
        {editing ? (
          <View className="gap-3 py-1">
            <FormField label="Nama Tugas" required>
              <Input value={nama} onChangeText={setNama} />
            </FormField>
            <FormField label="Deskripsi">
              <Textarea value={deskripsi} onChangeText={setDeskripsi} numberOfLines={4} />
            </FormField>
            <FormField label="PIC">
              <SearchableSelect value={pic} onChange={setPic} options={userNames} placeholder="Pilih PIC" />
            </FormField>
            <FormField label="Tenggat Waktu">
              <DatePicker value={tenggat} onChange={setTenggat} />
            </FormField>
            <FormField label="Status">
              <SearchableSelect value={status} onChange={setStatus} options={STATUSES} />
            </FormField>
          </View>
        ) : (
          <View className="gap-3 py-1">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="text-base font-bold flex-1">{task.nama}</Text>
              <StatusBadge status={task.status} />
            </View>
            <Text className="text-sm text-muted-foreground">{task.deskripsi || "Tidak ada deskripsi."}</Text>
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground">Project: {task.project || "-"}</Text>
              <Text className="text-xs text-muted-foreground">PIC: {task.pic || "-"}</Text>
              <Text className="text-xs text-muted-foreground">Tenggat: {task.tenggat ? tanggal(task.tenggat) : "-"}</Text>
              <Text className="text-xs text-muted-foreground">Perlu pembelian barang: {task.perluBarang ? "Ya" : "Tidak"}</Text>
            </View>
            {subTasks.length > 0 ? (
              <View className="gap-1">
                <Text className="text-xs font-semibold">Sub-tugas ({subTasks.length})</Text>
                {subTasks.map((s: Row) => (
                  <View key={s.id} className="flex-row items-center justify-between">
                    <Text className="text-xs">{s.nama}</Text>
                    <StatusBadge status={s.status} />
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}
        <DialogFooter className="gap-2">
          {editing ? (
            <>
              <Button variant="outline" onPress={() => setEditing(false)} disabled={saving}>
                <Text>Batal</Text>
              </Button>
              <Button onPress={save} disabled={saving}>
                <Text className="text-white font-semibold">{saving ? "Menyimpan..." : "Simpan"}</Text>
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onPress={() => onOpenChange(false)}>
                <Text>Tutup</Text>
              </Button>
              <Button onPress={() => setEditing(true)}>
                <Text className="text-white font-semibold">Edit Tugas</Text>
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

