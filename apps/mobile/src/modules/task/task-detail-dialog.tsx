import * as React from "react";
import { View, Pressable, Platform, ScrollView, Linking } from "react-native";
import { Upload, Eye, Edit3, FileText, ExternalLink } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { DatePicker, SearchableSelect } from "@/components/taska/dialogs";
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { apiBase } from "@/services/api";
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
  const [proofFileId, setProofFileId] = React.useState<number | null>(null);

  const fileInputRef = React.useRef<any>(null);
  const fileUploaderRef = React.useRef<FileUploaderHandle | null>(null);

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
      setProofFileId((active.proofFileId || active.bastFileId || active.fileId) ? Number(active.proofFileId || active.bastFileId || active.fileId) : null);
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

    let finalFid = proofFileId;
    if (!finalFid && fileUploaderRef.current?.hasStaged()) {
      try {
        finalFid = await fileUploaderRef.current.flush();
      } catch {}
    }

    if (status === "DONE" && !finalFid && !liveTask?.proofFileId && !task?.proofFileId && !liveTask?.bastFileId && !task?.bastFileId && !liveTask?.fileId && !task?.fileId) {
      toast("Bukti selesai tugas (foto/dokumen) wajib diunggah sebelum status dapat diubah ke DONE", "danger");
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
        ...(finalFid ? { proofFileId: finalFid, fileId: finalFid } : {}),
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
      <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl w-[94vw] max-h-[92vh] flex flex-col p-6">
        <DialogHeader className="shrink-0 mb-1">
          <DialogTitle>{editing ? "Edit Tugas" : "Detail Tugas"}</DialogTitle>
        </DialogHeader>
        <ScrollView className="flex-1 -mx-2 px-2" contentContainerClassName="gap-3 py-1 pb-4" showsVerticalScrollIndicator>
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
                <View className="border border-border/80 rounded-xl overflow-hidden bg-card/60">
                  <Textarea
                    value={deskripsi}
                    onChangeText={setDeskripsi}
                    numberOfLines={8}
                    placeholder="Deskripsi tugas... Mendukung format Markdown (.md), tabel, checklist [ ], dll."
                    className="min-h-[140px] max-h-[450px] font-mono text-xs border-0 bg-transparent rounded-none w-full"
                  />
                </View>
              ) : (
                <View className="bg-panel/40 border border-border/80 rounded-xl p-3 min-h-[100px] max-h-[450px]">
                  <ScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                    className="max-h-[420px]"
                  >
                    <MarkdownView content={deskripsi} />
                  </ScrollView>
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

            {status === "DONE" && (
              <View className="gap-1 mt-1 p-3 rounded-xl border border-primary/30 bg-primary/5">
                <Text className="text-xs font-semibold text-foreground">
                  Bukti Selesai Tugas (Wajib untuk Status DONE) *
                </Text>
                <Text className="text-[11px] text-muted-foreground mb-1.5">
                  Lampirkan foto hasil pekerjaan, screenshot pengujian, atau dokumen serah terima pekerjaan.
                </Text>
                <FileUploader
                  label="Upload Bukti Selesai (Foto / Dokumen / PDF) *"
                  kind="semua"
                  accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
                  allowedExtensions={["jpg", "jpeg", "png", "webp", "pdf"]}
                  category="task-proof"
                  handleRef={(h) => { fileUploaderRef.current = h; }}
                  autoFlush
                  onUploaded={(id) => setProofFileId(id)}
                />
              </View>
            )}
          </View>
        ) : (
          <View className="gap-3 py-1">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="text-base font-bold flex-1">{nama || liveTask?.nama || task.nama}</Text>
              <StatusBadge status={status || liveTask?.status || task.status} />
            </View>
            <View className="gap-1">
              <Text className="text-xs font-semibold text-muted-foreground">Deskripsi / Spesifikasi</Text>
              <View className="bg-panel/40 border border-border/80 rounded-xl p-3.5 max-h-[500px]">
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  className="max-h-[460px]"
                >
                  <MarkdownView content={deskripsi !== undefined ? deskripsi : (liveTask?.deskripsi ?? task.deskripsi)} />
                </ScrollView>
              </View>
            </View>
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground">Project: {liveTask?.project || task.project || "-"}</Text>
              <Text className="text-xs text-muted-foreground">PIC: {pic || liveTask?.pic || task.pic || "-"}</Text>
              <Text className="text-xs text-muted-foreground">Tenggat: {(tenggat || liveTask?.tenggat || task.tenggat) ? tanggal(tenggat || liveTask?.tenggat || task.tenggat) : "-"}</Text>
              <Text className="text-xs text-muted-foreground">Perlu pembelian barang: {(liveTask?.perluBarang ?? task.perluBarang) ? "Ya" : "Tidak"}</Text>
            </View>
            {(liveTask?.proofFileId || task.proofFileId || liveTask?.bastFileId || task.bastFileId || liveTask?.fileId || task.fileId) ? (() => {
              const fid = liveTask?.proofFileId || task.proofFileId || liveTask?.bastFileId || task.bastFileId || liveTask?.fileId || task.fileId;
              const fileUrl = `${apiBase()}/files/${fid}`;
              return (
                <View className="gap-1.5 p-3 rounded-xl border border-border bg-card">
                  <Text className="text-xs font-semibold text-foreground">Bukti Selesai Tugas (Lampiran)</Text>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2 flex-1 mr-2">
                      <FileText size={16} color={colors.primary} />
                      <Text className="text-xs text-foreground font-medium truncate" numberOfLines={1}>
                        Bukti Selesai #{fid}
                      </Text>
                    </View>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 flex-row items-center gap-1"
                      onPress={() => {
                        if (typeof window !== "undefined") window.open(fileUrl, "_blank");
                        else Linking.openURL(fileUrl).catch(() => {});
                      }}
                    >
                      <ExternalLink size={12} color={colors.textSecondary} />
                      <Text className="text-xs">Buka Bukti</Text>
                    </Button>
                  </View>
                </View>
              );
            })() : null}
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
        </ScrollView>
        <DialogFooter className="shrink-0 mt-2 pt-2 gap-2">
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

