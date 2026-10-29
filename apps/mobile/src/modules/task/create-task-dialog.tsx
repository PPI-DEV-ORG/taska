import * as React from "react";
import { View, Pressable, Platform, ScrollView } from "react-native";
import { Upload, Eye, Edit3 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/taska/basics";
import { DatePicker, SearchableSelect } from "@/components/taska/dialogs";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { MarkdownView } from "./markdown-view";

export function CreateTaskDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  existingTasks = [],
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId?: string | number;
  projectName?: string;
  existingTasks?: any[];
  onCreated?: () => void;
}) {
  const { data, addRow, toast } = useApp();
  const [nama, setNama] = React.useState("");
  const [deskripsi, setDeskripsi] = React.useState("");
  const [parentTask, setParentTask] = React.useState("(Tugas Utama)");
  const [pic, setPic] = React.useState("");
  const [tenggat, setTenggat] = React.useState("");
  const [perluBarang, setPerluBarang] = React.useState("Tidak");
  const [editorTab, setEditorTab] = React.useState<"write" | "preview">("write");
  const [saving, setSaving] = React.useState(false);

  const fileInputRef = React.useRef<any>(null);

  const [prevOpen, setPrevOpen] = React.useState(false);
  if (open && !prevOpen) {
    setPrevOpen(true);
    setNama("");
    setDeskripsi("");
    setParentTask("(Tugas Utama)");
    setPic("");
    setTenggat("");
    setPerluBarang("Tidak");
    setEditorTab("write");
  } else if (!open && prevOpen) {
    setPrevOpen(false);
  }

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

  const userNames = (data.users ?? []).map((u: any) => String(u.name || u.nama || "")).filter(Boolean);
  const parentOptions = [
    "(Tugas Utama)",
    ...existingTasks.filter((t) => !t.parent && !t.parentId).map((t) => String(t.nama || t.name)).filter(Boolean),
  ];

  async function handleSave() {
    if (!nama.trim()) {
      toast("Nama tugas wajib diisi", "danger");
      return;
    }
    if (!pic.trim()) {
      toast("PIC tugas wajib dipilih", "danger");
      return;
    }

    setSaving(true);
    try {
      const parentRow =
        parentTask && parentTask !== "(Tugas Utama)"
          ? existingTasks.find((t) => (t.nama || t.name) === parentTask)
          : undefined;

      await addRow("tasks", {
        projectId,
        project: projectName,
        parentId: parentRow?.id,
        nama: nama.trim(),
        deskripsi: deskripsi.trim() || undefined,
        pic,
        tenggat: tenggat || new Date().toISOString().slice(0, 10),
        perluBarang: perluBarang === "Ya",
        status: "TODO",
      });

      toast("Tugas project berhasil ditambahkan", "success");
      onOpenChange(false);
      onCreated?.();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyimpan tugas", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl w-[94vw] max-h-[92vh] flex flex-col p-6">
        <DialogHeader className="shrink-0 mb-1">
          <DialogTitle>Tambah Tugas Project</DialogTitle>
        </DialogHeader>

        <ScrollView className="flex-1 -mx-2 px-2" contentContainerClassName="gap-4 py-1 pb-4" showsVerticalScrollIndicator>
          <FormField label="Nama Tugas" required>
            <Input
              value={nama}
              onChangeText={setNama}
              placeholder="Contoh: Penarikan kabel lantai 2"
            />
          </FormField>

          {/* Deskripsi dengan opsi Upload MD & Preview */}
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
                      className="flex-row items-center gap-1 px-2.5 py-1 rounded-md bg-muted/70 hover:bg-muted border border-border/80"
                    >
                      <Upload size={12} color={colors.text} />
                      <Text className="text-[11px] font-medium text-foreground">Upload .md</Text>
                    </Pressable>
                  </>
                )}
                <View className="flex-row items-center rounded-lg bg-muted/60 p-0.5 border border-border/60">
                  <Pressable
                    onPress={() => setEditorTab("write")}
                    className={`flex-row items-center gap-1 px-2.5 py-1 rounded-md ${
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
                    className={`flex-row items-center gap-1 px-2.5 py-1 rounded-md ${
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
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator
                  contentContainerClassName="min-w-full"
                >
                  <Textarea
                    value={deskripsi}
                    onChangeText={setDeskripsi}
                    numberOfLines={10}
                    placeholder="Detail instruksi / spesifikasi pengerjaan tugas... Mendukung format Markdown (.md), tabel, checklist [ ], dll."
                    className="min-h-[180px] max-h-[450px] font-mono text-xs border-0 bg-transparent rounded-none min-w-[650px] w-full"
                    style={{ whiteSpace: "pre", overflowX: "auto", overflowY: "auto" } as any}
                  />
                </ScrollView>
              </View>
            ) : (
              <View className="bg-panel/40 border border-border/80 rounded-xl p-3 min-h-[180px] max-h-[480px]">
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  className="max-h-[450px]"
                >
                  <ScrollView
                    horizontal
                    nestedScrollEnabled
                    showsHorizontalScrollIndicator
                    contentContainerClassName="min-w-full"
                  >
                    <View className="min-w-full">
                      <MarkdownView content={deskripsi || "*Belum ada deskripsi yang ditulis.*"} />
                    </View>
                  </ScrollView>
                </ScrollView>
              </View>
            )}
          </View>

          <FormField label="Sub-tugas dari (Opsional)">
            <SearchableSelect
              value={parentTask}
              onChange={setParentTask}
              options={parentOptions}
              placeholder="Pilih sub-tugas dari (opsional)"
            />
          </FormField>

          <FormField label="PIC Tugas" required>
            <SearchableSelect
              value={pic}
              onChange={setPic}
              options={userNames}
              placeholder="Pilih PIC tugas"
            />
          </FormField>

          <FormField label="Tenggat Waktu">
            <DatePicker
              value={tenggat}
              onChange={setTenggat}
              placeholder="Pilih tenggat waktu"
            />
          </FormField>

          <FormField label="Perlu Pembelian Barang?">
            <SearchableSelect
              value={perluBarang}
              onChange={setPerluBarang}
              options={["Tidak", "Ya"]}
            />
          </FormField>
        </ScrollView>

        <DialogFooter className="shrink-0 mt-2 pt-2 gap-2">
          <Button variant="outline" onPress={() => onOpenChange(false)} disabled={saving}>
            <Text>Batal</Text>
          </Button>
          <Button onPress={handleSave} disabled={saving}>
            <Text className="text-white font-semibold">{saving ? "Menyimpan..." : "Simpan Tugas"}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

