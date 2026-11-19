import * as React from "react";
import { View, ScrollView, Platform, Pressable, Alert } from "react-native";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Layers, Plus, Trash2, Pencil, X, CheckSquare, Building, Wrench, DollarSign } from "lucide-react-native";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/taska/dialogs";
import { colors } from "@/tokens";
import type { MaintCategory, MaintChecklist, MaintVendor } from "../types";

export function MaintenanceMasterDialog({
  visible,
  onClose,
  categories,
  checklists,
  vendors,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onCreateChecklist,
  onUpdateChecklist,
  onDeleteChecklist,
  onCreateVendor,
  onUpdateVendor,
  onDeleteVendor,
  onRefresh,
}: {
  visible: boolean;
  onClose: () => void;
  categories: MaintCategory[];
  checklists: MaintChecklist[];
  vendors: MaintVendor[];
  onCreateCategory: (cat: any) => Promise<void>;
  onUpdateCategory?: (id: number, cat: any) => Promise<void>;
  onDeleteCategory?: (id: number) => Promise<void>;
  onCreateChecklist: (chk: any) => Promise<void>;
  onUpdateChecklist?: (id: number, chk: any) => Promise<void>;
  onDeleteChecklist?: (id: number) => Promise<void>;
  onCreateVendor: (ven: any) => Promise<void>;
  onUpdateVendor?: (id: number, ven: any) => Promise<void>;
  onDeleteVendor?: (id: number) => Promise<void>;
  onRefresh: () => void;
}) {
  const [activeTab, setActiveTab] = React.useState<"categories" | "checklists" | "vendors">("categories");

  // Category state
  const [editingCatId, setEditingCatId] = React.useState<number | null>(null);
  const [catCode, setCatCode] = React.useState("");
  const [catName, setCatName] = React.useState("");
  const [catDesc, setCatDesc] = React.useState("");

  // Checklist state
  const [editingChkId, setEditingChkId] = React.useState<number | null>(null);
  const [chkCode, setChkCode] = React.useState("");
  const [chkName, setChkName] = React.useState("");
  const [chkCatId, setChkCatId] = React.useState<number | "">("");
  const [chkItems, setChkItems] = React.useState<string[]>([""]);

  // Vendor state
  const [editingVenId, setEditingVenId] = React.useState<number | null>(null);
  const [venCode, setVenCode] = React.useState("");
  const [venName, setVenName] = React.useState("");
  const [venContact, setVenContact] = React.useState("");
  const [venPhone, setVenPhone] = React.useState("");
  const [venSpec, setVenSpec] = React.useState("");

  const [busy, setBusy] = React.useState(false);

  if (!visible) return null;

  // Category handlers
  const handleStartEditCategory = (c: MaintCategory) => {
    setEditingCatId(c.id);
    setCatCode(c.code);
    setCatName(c.name);
    setCatDesc(c.description || "");
  };

  const handleCancelEditCategory = () => {
    setEditingCatId(null);
    setCatCode("");
    setCatName("");
    setCatDesc("");
  };

  const handleSaveCategory = async () => {
    if (!catName.trim()) return;
    try {
      setBusy(true);
      if (editingCatId) {
        if (onUpdateCategory) {
          await onUpdateCategory(editingCatId, {
            name: catName.trim(),
            description: catDesc.trim() || undefined,
          });
        }
      } else {
        if (!catCode.trim()) return;
        await onCreateCategory({
          code: catCode.trim(),
          name: catName.trim(),
          description: catDesc.trim() || undefined,
        });
      }
      handleCancelEditCategory();
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteCategory = (c: MaintCategory) => {
    const doDelete = async () => {
      try {
        setBusy(true);
        if (onDeleteCategory) await onDeleteCategory(c.id);
        onRefresh();
      } finally {
        setBusy(false);
      }
    };

    if (Platform.OS === "web") {
      if (confirm(`Hapus kategori "${c.name}"?`)) {
        doDelete();
      }
    } else {
      Alert.alert("Hapus Kategori", `Apakah Anda yakin ingin menghapus kategori "${c.name}"?`, [
        { text: "Batal", style: "cancel" },
        { text: "Hapus", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  // Checklist handlers
  const handleStartEditChecklist = (c: MaintChecklist) => {
    setEditingChkId(c.id);
    setChkCode(c.code);
    setChkName(c.name);
    setChkCatId(c.categoryId);
    const existing = c.items && c.items.length > 0 ? c.items.map((i) => i.itemText) : [""];
    setChkItems(existing);
  };

  const handleCancelEditChecklist = () => {
    setEditingChkId(null);
    setChkCode("");
    setChkName("");
    setChkCatId("");
    setChkItems([""]);
  };

  const handleSaveChecklist = async () => {
    if (!chkName.trim() || !chkCatId) return;
    const items = chkItems.filter((t) => t.trim().length > 0).map((t, idx) => ({ itemText: t.trim(), sequence: idx + 1 }));
    try {
      setBusy(true);
      if (editingChkId) {
        if (onUpdateChecklist) {
          await onUpdateChecklist(editingChkId, {
            name: chkName.trim(),
            categoryId: Number(chkCatId),
            items,
          });
        }
      } else {
        if (!chkCode.trim()) return;
        await onCreateChecklist({
          code: chkCode.trim(),
          name: chkName.trim(),
          categoryId: Number(chkCatId),
          items,
        });
      }
      handleCancelEditChecklist();
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteChecklist = (c: MaintChecklist) => {
    const doDelete = async () => {
      try {
        setBusy(true);
        if (onDeleteChecklist) await onDeleteChecklist(c.id);
        onRefresh();
      } finally {
        setBusy(false);
      }
    };

    if (Platform.OS === "web") {
      if (confirm(`Hapus template checklist "${c.name}"?`)) {
        doDelete();
      }
    } else {
      Alert.alert("Hapus Checklist", `Apakah Anda yakin ingin menghapus checklist "${c.name}"?`, [
        { text: "Batal", style: "cancel" },
        { text: "Hapus", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  // Vendor handlers
  const handleStartEditVendor = (v: MaintVendor) => {
    setEditingVenId(v.id);
    setVenCode(v.code);
    setVenName(v.name);
    setVenContact(v.contactPerson || "");
    setVenPhone(v.phone || "");
    setVenSpec(v.specialization || "");
  };

  const handleCancelEditVendor = () => {
    setEditingVenId(null);
    setVenCode("");
    setVenName("");
    setVenContact("");
    setVenPhone("");
    setVenSpec("");
  };

  const handleSaveVendor = async () => {
    if (!venName.trim()) return;
    try {
      setBusy(true);
      if (editingVenId) {
        if (onUpdateVendor) {
          await onUpdateVendor(editingVenId, {
            name: venName.trim(),
            contactPerson: venContact.trim() || undefined,
            phone: venPhone.trim() || undefined,
            specialization: venSpec.trim() || undefined,
          });
        }
      } else {
        if (!venCode.trim()) return;
        await onCreateVendor({
          code: venCode.trim(),
          name: venName.trim(),
          contactPerson: venContact.trim() || undefined,
          phone: venPhone.trim() || undefined,
          specialization: venSpec.trim() || undefined,
        });
      }
      handleCancelEditVendor();
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteVendor = (v: MaintVendor) => {
    const doDelete = async () => {
      try {
        setBusy(true);
        if (onDeleteVendor) await onDeleteVendor(v.id);
        onRefresh();
      } finally {
        setBusy(false);
      }
    };

    if (Platform.OS === "web") {
      if (confirm(`Hapus vendor "${v.name}"?`)) {
        doDelete();
      }
    } else {
      Alert.alert("Hapus Vendor", `Apakah Anda yakin ingin menghapus vendor "${v.name}"?`, [
        { text: "Batal", style: "cancel" },
        { text: "Hapus", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const categoryOptions = categories.map((c) => `${c.id} - ${c.name} (${c.code})`);
  const selectedChkCategoryStr = chkCatId
    ? categoryOptions.find((o) => o.startsWith(`${chkCatId} -`)) || String(chkCatId)
    : "";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-[96vw] max-w-2xl max-h-[92vh] p-0"
        style={Platform.select({
          web: { width: "min(96vw, 760px)", maxWidth: "760px" } as any,
        })}
      >
        <DialogHeader className="border-b border-border/70 px-6 py-4">
          <View className="flex-row items-center gap-3">
            <View className="rounded-lg p-2" style={{ backgroundColor: `${colors.primary}18` }}>
              <Layers size={18} color={colors.primary} />
            </View>
            <View>
              <DialogTitle>Master Data Maintenance Management</DialogTitle>
              <Text className="text-xs text-muted-foreground">
                Kelola kategori pemeliharaan, template checklist SOP, direktori vendor & biaya
              </Text>
            </View>
          </View>
        </DialogHeader>

        {/* Tab Bar */}
        <View className="flex-row border-b border-border/70 px-6">
          {[
            { key: "categories", label: `Kategori (${categories.length})`, icon: Layers },
            { key: "checklists", label: `Template Checklist (${checklists.length})`, icon: CheckSquare },
            { key: "vendors", label: `Vendor / Bengkel (${vendors.length})`, icon: Building },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key as any)}
                className="flex-row items-center gap-2 py-3 px-4 border-b-2"
                style={{
                  borderColor: isActive ? colors.primary : "transparent",
                }}
              >
                <Icon size={14} color={isActive ? colors.primary : "#64748b"} />
                <Text
                  className="text-xs font-semibold"
                  style={{
                    color: isActive ? colors.primary : "#64748b",
                  }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Content */}
        <ScrollView className="max-h-[65vh] px-6 py-4" contentContainerStyle={{ gap: 16 }}>
          {/* 1. KATEGORI */}
          {activeTab === "categories" && (
            <View className="gap-4">
              {/* Form Input / Edit */}
              <View className="rounded-xl border border-border/80 bg-muted/30 p-4 gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-bold text-foreground">
                    {editingCatId ? "✏️ Edit Kategori Maintenance" : "+ Tambah Kategori Maintenance Baru"}
                  </Text>
                  {editingCatId && (
                    <Button variant="ghost" size="sm" onPress={handleCancelEditCategory}>
                      <Text className="text-xs text-muted-foreground">Batal</Text>
                    </Button>
                  )}
                </View>

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Input
                      placeholder="Kode (CAT-VEHICLE)"
                      value={catCode}
                      onChangeText={setCatCode}
                      editable={!editingCatId}
                    />
                  </View>
                  <View className="flex-[2]">
                    <Input
                      placeholder="Nama Kategori (Vehicle Maintenance)"
                      value={catName}
                      onChangeText={setCatName}
                    />
                  </View>
                </View>
                <Input
                  placeholder="Keterangan kategori pemeliharaan..."
                  value={catDesc}
                  onChangeText={setCatDesc}
                />
                <View className="flex-row justify-end gap-2">
                  {editingCatId && (
                    <Button variant="outline" size="sm" onPress={handleCancelEditCategory}>
                      <Text className="text-xs">Batal</Text>
                    </Button>
                  )}
                  <Button size="sm" onPress={handleSaveCategory} disabled={busy}>
                    <Text className="text-xs text-white">
                      {editingCatId ? "Perbarui Kategori" : "Simpan Kategori"}
                    </Text>
                  </Button>
                </View>
              </View>

              {/* List */}
              <View className="gap-2">
                {categories.length === 0 ? (
                  <Text className="text-center py-6 text-xs text-muted-foreground">Belum ada kategori terdaftar.</Text>
                ) : (
                  categories.map((c) => (
                    <View
                      key={c.id}
                      className="rounded-xl border border-border/80 bg-card p-3 flex-row justify-between items-center gap-3"
                    >
                      <View className="gap-1 flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-sm font-bold text-foreground">{c.name}</Text>
                          <Text className="text-[11px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                            {c.code}
                          </Text>
                        </View>
                        {c.description && (
                          <Text className="text-xs text-muted-foreground">{c.description}</Text>
                        )}
                      </View>

                      <View className="flex-row items-center gap-1">
                        <Pressable
                          onPress={() => handleStartEditCategory(c)}
                          className="p-2 rounded-lg hover:bg-muted/50"
                          hitSlop={6}
                        >
                          <Pencil size={15} color={colors.primary} />
                        </Pressable>
                        <Pressable
                          onPress={() => handleDeleteCategory(c)}
                          className="p-2 rounded-lg hover:bg-destructive/10"
                          hitSlop={6}
                        >
                          <Trash2 size={15} color="#dc2626" />
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {/* 2. CHECKLISTS */}
          {activeTab === "checklists" && (
            <View className="gap-4">
              <View className="rounded-xl border border-border/80 bg-muted/30 p-4 gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-bold text-foreground">
                    {editingChkId ? "✏️ Edit Template Checklist SOP" : "+ Buat Template Checklist SOP Baru"}
                  </Text>
                  {editingChkId && (
                    <Button variant="ghost" size="sm" onPress={handleCancelEditChecklist}>
                      <Text className="text-xs text-muted-foreground">Batal</Text>
                    </Button>
                  )}
                </View>

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Input
                      placeholder="Kode (CHK-VEHICLE)"
                      value={chkCode}
                      onChangeText={setChkCode}
                      editable={!editingChkId}
                    />
                  </View>
                  <View className="flex-[2]">
                    <Input
                      placeholder="Nama Template (Checklist Armada)"
                      value={chkName}
                      onChangeText={setChkName}
                    />
                  </View>
                </View>

                <SearchableSelect
                  placeholder="-- Pilih Kategori --"
                  value={selectedChkCategoryStr}
                  options={categoryOptions}
                  onChange={(val) => setChkCatId(val ? Number(val.split(" - ")[0]) : "")}
                  clearable
                />

                {/* Items */}
                <Text className="text-xs font-semibold text-foreground/80 mt-1">
                  Daftar Item Pemeriksaan Checklist:
                </Text>
                {chkItems.map((itemText, idx) => (
                  <View key={idx} className="flex-row gap-2 items-center">
                    <Text className="text-xs font-semibold w-5 text-muted-foreground">{idx + 1}.</Text>
                    <View className="flex-1">
                      <Input
                        placeholder={`Item pemeriksaan ${idx + 1}...`}
                        value={itemText}
                        onChangeText={(val) => {
                          const copy = [...chkItems];
                          copy[idx] = val;
                          setChkItems(copy);
                        }}
                      />
                    </View>
                    {chkItems.length > 1 && (
                      <Pressable
                        onPress={() => setChkItems(chkItems.filter((_, i) => i !== idx))}
                        hitSlop={6}
                        className="p-1"
                      >
                        <Trash2 size={16} color="#dc2626" />
                      </Pressable>
                    )}
                  </View>
                ))}

                <View className="flex-row justify-between items-center pt-2">
                  <Button size="sm" variant="outline" onPress={() => setChkItems([...chkItems, ""])}>
                    <Text className="text-xs">+ Tambah Baris Checklist</Text>
                  </Button>
                  <View className="flex-row gap-2">
                    {editingChkId && (
                      <Button variant="outline" size="sm" onPress={handleCancelEditChecklist}>
                        <Text className="text-xs">Batal</Text>
                      </Button>
                    )}
                    <Button size="sm" onPress={handleSaveChecklist} disabled={busy}>
                      <Text className="text-xs text-white">
                        {editingChkId ? "Perbarui Template" : "Simpan Template"}
                      </Text>
                    </Button>
                  </View>
                </View>
              </View>

              {/* List */}
              <View className="gap-2">
                {checklists.length === 0 ? (
                  <Text className="text-center py-6 text-xs text-muted-foreground">Belum ada template checklist.</Text>
                ) : (
                  checklists.map((c) => (
                    <View
                      key={c.id}
                      className="rounded-xl border border-border/80 bg-card p-3 flex-row justify-between items-center gap-3"
                    >
                      <View className="gap-1 flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-sm font-bold text-foreground">{c.name}</Text>
                          <Text className="text-[11px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                            {c.code}
                          </Text>
                        </View>
                        <Text className="text-xs text-muted-foreground">
                          Kategori: {c.category?.name || "-"} · {c.items?.length || 0} item pemeriksaan
                        </Text>
                      </View>

                      <View className="flex-row items-center gap-1">
                        <Pressable
                          onPress={() => handleStartEditChecklist(c)}
                          className="p-2 rounded-lg hover:bg-muted/50"
                          hitSlop={6}
                        >
                          <Pencil size={15} color={colors.primary} />
                        </Pressable>
                        <Pressable
                          onPress={() => handleDeleteChecklist(c)}
                          className="p-2 rounded-lg hover:bg-destructive/10"
                          hitSlop={6}
                        >
                          <Trash2 size={15} color="#dc2626" />
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {/* 3. VENDORS */}
          {activeTab === "vendors" && (
            <View className="gap-4">
              <View className="rounded-xl border border-border/80 bg-muted/30 p-4 gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-bold text-foreground">
                    {editingVenId ? "✏️ Edit Vendor Servis / Bengkel" : "+ Tambah Vendor Servis / Bengkel Baru"}
                  </Text>
                  {editingVenId && (
                    <Button variant="ghost" size="sm" onPress={handleCancelEditVendor}>
                      <Text className="text-xs text-muted-foreground">Batal</Text>
                    </Button>
                  )}
                </View>

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Input
                      placeholder="Kode (VND-001)"
                      value={venCode}
                      onChangeText={setVenCode}
                      editable={!editingVenId}
                    />
                  </View>
                  <View className="flex-[2]">
                    <Input
                      placeholder="Nama Vendor / Bengkel *"
                      value={venName}
                      onChangeText={setVenName}
                    />
                  </View>
                </View>
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Input
                      placeholder="PIC Kontak"
                      value={venContact}
                      onChangeText={setVenContact}
                    />
                  </View>
                  <View className="flex-1">
                    <Input
                      placeholder="No. Telepon / WA"
                      value={venPhone}
                      onChangeText={setVenPhone}
                    />
                  </View>
                </View>
                <Input
                  placeholder="Spesialisasi (misal: AC Mobil, Perbaikan Laptop, Mesin Bubut)"
                  value={venSpec}
                  onChangeText={setVenSpec}
                />
                <View className="flex-row justify-end gap-2">
                  {editingVenId && (
                    <Button variant="outline" size="sm" onPress={handleCancelEditVendor}>
                      <Text className="text-xs">Batal</Text>
                    </Button>
                  )}
                  <Button size="sm" onPress={handleSaveVendor} disabled={busy}>
                    <Text className="text-xs text-white">
                      {editingVenId ? "Perbarui Vendor" : "Simpan Vendor"}
                    </Text>
                  </Button>
                </View>
              </View>

              {/* List */}
              <View className="gap-2">
                {vendors.length === 0 ? (
                  <Text className="text-center py-6 text-xs text-muted-foreground">Belum ada vendor terdaftar.</Text>
                ) : (
                  vendors.map((v) => (
                    <View
                      key={v.id}
                      className="rounded-xl border border-border/80 bg-card p-3 flex-row justify-between items-center gap-3"
                    >
                      <View className="gap-1 flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-sm font-bold text-foreground">{v.name}</Text>
                          <Text className="text-[11px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                            {v.code}
                          </Text>
                        </View>
                        <Text className="text-xs text-muted-foreground">
                          Kontak: {v.contactPerson || "-"} ({v.phone || "-"}) · Spesialisasi: {v.specialization || "-"}
                        </Text>
                      </View>

                      <View className="flex-row items-center gap-1">
                        <Pressable
                          onPress={() => handleStartEditVendor(v)}
                          className="p-2 rounded-lg hover:bg-muted/50"
                          hitSlop={6}
                        >
                          <Pencil size={15} color={colors.primary} />
                        </Pressable>
                        <Pressable
                          onPress={() => handleDeleteVendor(v)}
                          className="p-2 rounded-lg hover:bg-destructive/10"
                          hitSlop={6}
                        >
                          <Trash2 size={15} color="#dc2626" />
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}
        </ScrollView>

        <DialogFooter className="border-t border-border/70 px-6 py-3">
          <Button variant="outline" onPress={onClose}>
            <Text className="text-xs">Tutup</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
