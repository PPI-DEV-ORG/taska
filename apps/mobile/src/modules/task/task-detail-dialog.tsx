import * as React from "react";
import { View, Pressable, Platform } from "react-native";
import { Upload, Eye, Edit3, FileText } from "lucide-react-native";
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
import { colors } from "@/tokens";
import { type Row } from "@/constants/modules";
import { MarkdownView } from "./markdown-view";

const STATUSES = ["TODO", "IN PROGRESS", "PENDING", "TESTED", "DONE", "REJECTED", "BLOCKED"];

/** Detail + edit task. Klik "Edit" untuk mengubah nama, deskripsi, PIC, tenggat, status. */
export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onSaved,
}: {
  task: Row | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: (updatedTask: Row) => void;
}) {
  const { data, patchRow, toast } = useApp();
  const [prevKey, setPrevKey] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [editorTab, setEditorTab] = React.useState<"write" | "preview">("write");
  const [saving, setSaving] = React.useState(false);
  const [nama, setNama] = React.useState("");
  const [deskripsi, setDeskripsi] = React.useState("");
  const [pic, setPic] = React.useState("");
  const [tenggat, setTenggat] = React.useState("");
  const [status, setStatus] = React.useState("TODO");

  const fileInputRef = React.useRef<any>(null);

  const liveTask = React.useMemo(() => {
    if (!task) return null;
    return (data.tasks ?? []).find((t: Row) => String(t.id) === String(task.id)) ?? task;
  }, [data.tasks, task]);

  const handleUploadMdFile = (e: any) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result ?? "");
      setDeskripsi(text);
      toast(`File "${file.name}" berhasil dimuat ke deskripsi tugas!`, "success");
      setEditorTab("preview");
    };
    reader.readAsText(file);
    if (e.target) e.target.value = "";
  };

  const currentKey = open && task ? `${task.id}-${open}` : null;
  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    if (task && open) {
      const active = (data.tasks ?? []).find((t: Row) => String(t.id) === String(task.id)) ?? task;
      setEditing(false);
      setEditorTab("write");
      setNama(String(active.nama ?? ""));
      setDeskripsi(String(active.deskripsi ?? ""));
      setPic(String(active.pic ?? ""));
      setTenggat(String(active.tenggat ?? ""));
      setStatus(String(active.status ?? "TODO"));
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
      const patch = {
        nama: nama.trim(),
        deskripsi: deskripsi.trim(),
        pic,
        tenggat: tenggat || undefined,
        status,
      };
      await patchRow("tasks", task!.id, patch);
      toast("Tugas berhasil diperbarui");
      setEditing(false);
      onSaved?.({ ...task!, ...patch });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Tugas" : "Detail Tugas"}</DialogTitle>
        </DialogHeader>
        {editing ? (
          <View className="gap-3 py-1">
            <FormField label="Nama Tugas" required>
              <Input value={nama} onChangeText={setNama} />
            </FormField>
            
            <View className="gap-1.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-muted-foreground">Deskripsi / Spesifikasi Tugas</Text>
                <View className="flex-row items-center gap-2">
                  {Platform.OS === "web" && (
                    <>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept=".md,.markdown,.txt"
                        style={{ display: "none" }}
                        onChange={handleUploadMdFile}
                      />
                      <Pressable
                        onPress={() => fileInputRef.current?.click()}
                        className="flex-row items-center gap-1 px-2 py-1 rounded-md bg-muted/70 hover:bg-muted border border-border/80"
                      >
                        <Upload size={12} color={colors.text} />
                        <Text className="text-[11px] font-medium text-foreground">Upload .md</Text>
                      </Pressable>
                    </>
                  )}
                  <View className="flex-row items-center rounded-lg bg-muted/60 p-0.5 border border-border/60">
                    <Pressable
                      onPress={() => setEditorTab("write")}
                      className={`flex-row items-center gap-1 px-2 py-0.5 rounded-md ${
                        editorTab === "write" ? "bg-background shadow-xs" : ""
                      }`}
                    >
                      <Edit3 size={11} color={editorTab === "write" ? colors.primary : colors.muted} />
                      <Text
                        className={`text-[11px] font-medium ${
                          editorTab === "write" ? "text-primary font-bold" : "text-muted-foreground"
                        }`}
                      >
                        Tulis
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setEditorTab("preview")}
                      className={`flex-row items-center gap-1 px-2 py-0.5 rounded-md ${
                        editorTab === "preview" ? "bg-background shadow-xs" : ""
                      }`}
                    >
                      <Eye size={11} color={editorTab === "preview" ? colors.primary : colors.muted} />
                      <Text
                        className={`text-[11px] font-medium ${
                          editorTab === "preview" ? "text-primary font-bold" : "text-muted-foreground"
                        }`}
                      >
                        Preview
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              {editorTab === "write" ? (
                <Textarea
                  value={deskripsi}
                  onChangeText={setDeskripsi}
                  numberOfLines={7}
                  placeholder="Deskripsi tugas... Mendukung format Markdown (.md), tabel, checklist [ ], dll."
                  className="min-h-[140px] font-mono text-xs"
                />
              ) : (
                <View className="bg-panel/40 border border-border/80 rounded-xl p-3 min-h-[140px] max-h-[300px] overflow-y-auto">
                  <MarkdownView content={deskripsi} />
                </View>
              )}
            </View>

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
              <Text className="text-base font-bold flex-1">{nama || liveTask?.nama || task.nama}</Text>
              <StatusBadge status={status || liveTask?.status || task.status} />
            </View>
            <View className="gap-1">
              <Text className="text-xs font-semibold text-muted-foreground">Deskripsi / Spesifikasi</Text>
              <View className="bg-panel/40 border border-border/80 rounded-xl p-3.5 max-h-[360px] overflow-y-auto">
                <MarkdownView content={deskripsi !== undefined ? deskripsi : (liveTask?.deskripsi ?? task.deskripsi)} />
              </View>
            </View>
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground">Project: {liveTask?.project || task.project || "-"}</Text>
              <Text className="text-xs text-muted-foreground">PIC: {pic || liveTask?.pic || task.pic || "-"}</Text>
              <Text className="text-xs text-muted-foreground">Tenggat: {(tenggat || liveTask?.tenggat || task.tenggat) ? tanggal(tenggat || liveTask?.tenggat || task.tenggat) : "-"}</Text>
              <Text className="text-xs text-muted-foreground">Perlu pembelian barang: {(liveTask?.perluBarang ?? task.perluBarang) ? "Ya" : "Tidak"}</Text>
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

