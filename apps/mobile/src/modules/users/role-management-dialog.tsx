import * as React from "react";
import { View, ScrollView, Pressable, Platform } from "react-native";
import { Shield, Plus, Trash2, Check, Copy, RotateCcw } from "lucide-react-native";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { FormField } from "@/components/taska/basics";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import type { ActionCode } from "@/constants/modules";
import { getDefaultRoleDef } from "@/constants/modules";

const ALIAS_TO_UI_KEY: Record<string, string> = {
  financeOut: "invoices",
  requests: "purchase-requests",
  procurement: "supplier-pos",
  delivery: "delivery-notes",
  damageReports: "damage-reports",
  pocReports: "poc-reports",
  visitReports: "visit-reports",
  audit: "audit-log",
  attendance: "hr",
  payroll: "hr",
  masterData: "master-data",
  settings: "master-data",
  poClient: "po-client",
};

function normalizeRolePermissions(
  roleCode: string,
  rawPermissions?: Record<string, any>,
): Record<string, ActionCode[]> {
  const norm = (roleCode || "").toUpperCase();
  const sysDefault = getDefaultRoleDef(norm)?.permissions ?? {};
  const result: Record<string, ActionCode[]> = {};

  // Mulai dengan default sistem sesuai hardcoded
  for (const [k, v] of Object.entries(sysDefault)) {
    result[k] = Array.isArray(v) ? [...v] : [];
  }

  // Jika ada custom permissions, konversi string / array dan simpan
  if (rawPermissions && typeof rawPermissions === "object") {
    for (const [k, v] of Object.entries(rawPermissions)) {
      const uiKey = ALIAS_TO_UI_KEY[k] || k;
      if (Array.isArray(v)) {
        result[uiKey] = v as ActionCode[];
      } else if (typeof v === "string") {
        result[uiKey] = v.length > 0
          ? v
              .split("")
              .filter((c): c is ActionCode => ["M", "L", "C", "U", "A", "P", "V", "E"].includes(c))
          : [];
      }
    }
  }

  return result;
}

const ACTION_META: { code: ActionCode; label: string; desc: string }[] = [
  { code: "M", label: "Menu / Page", desc: "Tampil di sidebar & buka halaman" },
  { code: "L", label: "Lihat Data", desc: "Akses baca data & dropdown select" },
  { code: "C", label: "Buat", desc: "Tambah data / buat dokumen baru" },
  { code: "U", label: "Ubah", desc: "Edit data & ubah status tahapan" },
  { code: "A", label: "Hapus", desc: "Hapus baris atau batalkan dokumen" },
  { code: "P", label: "Harga/P&L", desc: "Lihat HPP, margin, & laba/rugi" },
  { code: "V", label: "Approve", desc: "Setujui / tolak pengajuan dokumen" },
  { code: "E", label: "Export", desc: "Cetak PDF, Excel, & CSV E-Faktur" },
];

const MODULE_GROUPS: {
  group: string;
  subtitle: string;
  items: { key: string; label: string; desc: string }[];
}[] = [
  {
    group: "CRM & Pra-Penjualan",
    subtitle: "Peluang bisnis, penawaran harga, survey teknis, demo POC, dan kunjungan klien",
    items: [
      { key: "leads", label: "Leads & Peluang", desc: "Prospek penjualan, kualifikasi & tahapan pipeline" },
      { key: "quotations", label: "Penawaran (Quotation)", desc: "Pembuatan & revisi penawaran harga ke customer" },
      { key: "surveys", label: "Survey Teknis Lapangan", desc: "Jadwal survey, catatan lapangan & biaya survey" },
      { key: "poc-reports", label: "Laporan POC & Demo", desc: "Dokumentasi uji coba perangkat & evaluasi POC" },
      { key: "visit-reports", label: "Laporan Kunjungan (MoM)", desc: "Risalah pertemuan klien & tindak lanjut kunjungan" },
      { key: "customers", label: "Data Pelanggan (Customer)", desc: "Master profil perusahaan & kontak PIC pelanggan" },
    ],
  },
  {
    group: "Penjualan & Manajemen Proyek",
    subtitle: "Pesanan pelanggan (SO), eksekusi proyek, BOQ, tugas teknisi, dan surat jalan",
    items: [
      { key: "po-client", label: "Sales Order (SO / PO Masuk)", desc: "Pencatatan PO pelanggan & penerbitan Sales Order" },
      { key: "projects", label: "Project & BOQ", desc: "Progres proyek, RAB/BOQ, BAST & profitabilitas proyek" },
      { key: "tasks", label: "Tugas & Tiket Kerja", desc: "Penugasan teknisi/engineer & checklist pekerjaan" },
      { key: "delivery-notes", label: "Delivery / Surat Jalan", desc: "Pengiriman barang, penyiapan SN & dokumen DO" },
    ],
  },
  {
    group: "Pengadaan (Procurement) & Gudang",
    subtitle: "Permintaan barang, PO supplier, penerimaan barang, stok, serial number, dan opname",
    items: [
      { key: "purchase-requests", label: "Purchase Request (PR)", desc: "Pengajuan pembelian barang proyek atau stok gudang" },
      { key: "supplier-pos", label: "Purchase Order (PO Supplier)", desc: "Penerbitan PO ke vendor/supplier & tagihan masuk" },
      { key: "shipments", label: "Pelacakan Pengiriman PO", desc: "Monitoring status pengiriman barang dari supplier" },
      { key: "receiving", label: "Penerimaan Barang (GRN)", desc: "Pemeriksaan fisik barang masuk & input Serial Number" },
      { key: "stock", label: "Stok Barang, Jasa & SN", desc: "Kartu stok, mutasi gudang, reservasi & lacak SN" },
      { key: "opname", label: "Stok Opname", desc: "Perhitungan fisik stok gudang & penyesuaian selisih" },
      { key: "damage-reports", label: "Kerusakan & Retur Barang", desc: "Laporan barang rusak, klaim garansi & retur" },
      { key: "suppliers", label: "Master Supplier / Vendor", desc: "Daftar pemasok, kategori barang & termin bayar" },
      { key: "warehouses", label: "Master Gudang", desc: "Daftar lokasi penyimpanan & cabang gudang" },
      { key: "products", label: "Master Produk & Jasa", desc: "Katalog barang/jasa, harga beli (HPP) & harga jual" },
    ],
  },
  {
    group: "Keuangan & Akuntansi",
    subtitle: "Penagihan faktur pelanggan, pembayaran, pengeluaran operasional, buku besar, dan laporan",
    items: [
      { key: "invoices", label: "Invoice & Kwitansi", desc: "Penagihan piutang customer, pencatatan bayar & E-Faktur" },
      { key: "expenses", label: "Pengeluaran & Reimbursement", desc: "Biaya operasional, kas kecil & klaim talangan staf" },
      { key: "accounting", label: "Buku Besar & COA", desc: "Jurnal akuntansi, bagan akun (Chart of Accounts) & neraca" },
      { key: "reports", label: "Laporan & Analitik", desc: "Rekap penjualan, keuangan, P&L proyek & performa tim" },
    ],
  },
  {
    group: "SDM / HR & Personalia",
    subtitle: "Absensi kehadiran, pengajuan cuti/izin, dan pengelolaan slip gaji karyawan",
    items: [
      { key: "hr", label: "Absensi & Payroll (HR)", desc: "Rekap kehadiran staf, komponen gaji & cetak slip gaji" },
    ],
  },
  {
    group: "Operasional, Sistem & Administrasi",
    subtitle: "Ringkasan eksekutif, kalender kerja, persetujuan dokumen, pengguna, dan log audit",
    items: [
      { key: "dashboard", label: "Dashboard Utama", desc: "Ringkasan KPI, grafik aktivitas & metrik sesuai divisi" },
      { key: "calendar", label: "Kalender Kerja", desc: "Jadwal survey, proyek, kunjungan, POC & jatuh tempo" },
      { key: "approvals", label: "Pusat Persetujuan (Approval)", desc: "Antrean persetujuan dokumen lintas modul" },
      { key: "master-data", label: "Master Data & Pengaturan", desc: "Konfigurasi kategori, sumber lead & profil perusahaan" },
      { key: "users", label: "Pengguna & Hak Akses", desc: "Kelola akun pengguna, penugasan gudang & role" },
      { key: "archive", label: "Arsip Dokumen Terpusat", desc: "Penyimpanan seluruh berkas PDF, foto & dokumen proyek" },
      { key: "audit-log", label: "Audit Log Sistem", desc: "Rekam jejak seluruh perubahan data oleh pengguna" },
    ],
  },
];

export function RoleManagementDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { roles, saveRole, deleteRole, toast } = useApp();
  const [selectedCode, setSelectedCode] = React.useState<string>("SALES");
  const [creatingNew, setCreatingNew] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newCode, setNewCode] = React.useState("");
  const [newDesc, setNewDesc] = React.useState("");
  const [cloneFrom, setCloneFrom] = React.useState<string>("SALES");
  const [draftName, setDraftName] = React.useState("");
  const [draftDesc, setDraftDesc] = React.useState("");
  const [draftPerms, setDraftPerms] = React.useState<Record<string, ActionCode[]>>({});
  const [saving, setSaving] = React.useState(false);
  const [draftSource, setDraftSource] = React.useState<{ role: typeof roles[number] | undefined; open: boolean } | null>(null);

  const activeRole = React.useMemo(
    () => roles.find((r) => r.code === selectedCode) ?? roles[0],
    [roles, selectedCode],
  );

  if (!creatingNew && open && activeRole && (draftSource?.role !== activeRole || !draftSource.open)) {
    setDraftName(activeRole.name);
    setDraftDesc(activeRole.description || "");
    setDraftPerms(normalizeRolePermissions(activeRole.code, activeRole.permissions));
    setDraftSource({ role: activeRole, open });
  } else if (!open && draftSource?.open) {
    setDraftSource({ role: draftSource.role, open: false });
  }

  function resetToDefault() {
    if (!activeRole) return;
    const defaults = getDefaultRoleDef(activeRole.code);
    if (!defaults) return;
    const copy: Record<string, ActionCode[]> = {};
    for (const [k, v] of Object.entries(defaults.permissions)) {
      copy[k] = [...v];
    }
    setDraftPerms(copy);
    toast(`Izin untuk ${activeRole.name} dikembalikan ke default sistem`, "info");
  }

  function startCreateNew() {
    setCreatingNew(true);
    setNewName("");
    setNewCode("");
    setNewDesc("");
    const source = roles.find((r) => r.code === cloneFrom);
    setDraftPerms(normalizeRolePermissions(cloneFrom, source?.permissions));
  }

  function handleCloneTemplateChange(code: string) {
    setCloneFrom(code);
    const source = roles.find((r) => r.code === code);
    setDraftPerms(normalizeRolePermissions(code, source?.permissions));
  }

  function togglePermission(moduleKey: string, action: ActionCode) {
    setDraftPerms((prev) => {
      const curr = new Set<ActionCode>(prev[moduleKey] ?? []);
      if (curr.has(action)) {
        curr.delete(action);
        // Jika mematikan Lihat Data ('L'), otomatis matikan Menu ('M') dan aksi lainnya
        if (action === "L") {
          curr.delete("M");
          curr.delete("C");
          curr.delete("U");
          curr.delete("A");
          curr.delete("P");
          curr.delete("V");
          curr.delete("E");
        }
      } else {
        curr.add(action);
        // Jika mengaktifkan Menu ('M'), Buat ('C'), Ubah ('U'), dsb, otomatis aktifkan Lihat Data ('L')
        if (action !== "L") {
          curr.add("L");
        }
      }
      return {
        ...prev,
        [moduleKey]: Array.from(curr),
      };
    });
  }

  function toggleAllForModule(moduleKey: string) {
    const allCodes = ACTION_META.map((a) => a.code);
    setDraftPerms((prev) => {
      const curr = prev[moduleKey] ?? [];
      const hasAll = allCodes.every((c) => curr.includes(c));
      return {
        ...prev,
        [moduleKey]: hasAll ? [] : [...allCodes],
      };
    });
  }

  function setGroupPermissions(keys: string[], mode: "menu" | "view" | "full" | "clear") {
    const allCodes = ACTION_META.map((a) => a.code);
    setDraftPerms((prev) => {
      const next = { ...prev };
      for (const k of keys) {
        if (mode === "clear") {
          next[k] = [];
        } else if (mode === "view") {
          const existing = new Set<ActionCode>(next[k] ?? []);
          existing.add("L");
          next[k] = Array.from(existing);
        } else if (mode === "menu") {
          const existing = new Set<ActionCode>(next[k] ?? []);
          existing.add("M");
          existing.add("L");
          next[k] = Array.from(existing);
        } else {
          next[k] = [...allCodes];
        }
      }
      return next;
    });
  }

  async function handleSave() {
    if (creatingNew) {
      if (!newName.trim()) {
        toast("Nama peran (role) baru wajib diisi", "danger");
        return;
      }
      const generatedCode = (newCode.trim() || newName.trim())
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, "_");
      setSaving(true);
      try {
        const updated = await saveRole(
          {
            code: generatedCode,
            name: newName.trim(),
            description: newDesc.trim() || `Role kustom ${newName.trim()}`,
            permissions: draftPerms,
          },
          false,
        );
        if (updated) {
          setCreatingNew(false);
          setSelectedCode(generatedCode);
        }
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!activeRole) return;
    setSaving(true);
    try {
      await saveRole(
        {
          code: activeRole.code,
          name: draftName.trim() || activeRole.name,
          description: draftDesc.trim(),
          permissions: draftPerms,
        },
        true,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!activeRole || activeRole.isSystem) return;
    const ok =
      typeof window !== "undefined"
        ? window.confirm(`Hapus role kustom "${activeRole.name}"?`)
        : true;
    if (!ok) return;
    setSaving(true);
    try {
      const updated = await deleteRole(activeRole.code);
      if (updated && updated.length > 0) {
        setSelectedCode(updated[0]!.code);
      }
    } finally {
      setSaving(false);
    }
  }

  const isSuperAdminSelected = !creatingNew && activeRole?.code === "SUPER_ADMIN";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[92vw] max-w-[840px] h-[82vh] max-h-[82vh] p-4 sm:p-5 overflow-hidden flex flex-col"
        style={Platform.select({
          web: { width: "92vw", maxWidth: 840, height: "82vh", maxHeight: "82vh" } as any,
          default: { width: "92%", maxWidth: 840, maxHeight: "85%" },
        })}
      >
        <DialogHeader style={{ flexShrink: 0 }}>
          <View className="flex-row flex-wrap items-center justify-between gap-3 pr-6">
            <View className="flex-row items-center gap-2.5" style={{ flex: 1, minWidth: 240 }}>
              <View className="size-9 rounded-xl bg-primary/15 items-center justify-center shrink-0">
                <Shield size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <DialogTitle className="text-base sm:text-lg font-bold">
                  Manajemen Peran & Matriks Hak Akses (Dynamic RBAC)
                </DialogTitle>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  Buat role baru sesuai struktur organisasi atau atur hak akses detail per modul dan aksi
                </Text>
              </View>
            </View>
            <Button
              size="sm"
              variant={creatingNew ? "default" : "outline"}
              onPress={startCreateNew}
              className="flex-row items-center gap-1.5 shrink-0"
            >
              <Plus size={14} color={creatingNew ? colors.background : colors.primary} />
              <Text className={creatingNew ? "text-xs font-semibold" : "text-xs font-semibold text-primary"}>
                Tambah Role Kustom
              </Text>
            </Button>
          </View>
        </DialogHeader>

        <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ paddingRight: 4, paddingBottom: 8 }}>
          <View className="gap-3.5 py-1">
            {/* Daftar Pilihan Role (Wrap penuh agar tidak terpotong) */}
            <View className="bg-panel/40 border border-border rounded-xl p-2.5 sm:p-3 gap-2">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Pilih Peran (Role) untuk Dikelola ({roles.length} Role Terdaftar)
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                {roles.map((r) => {
                  const active = !creatingNew && r.code === activeRole?.code;
                  return (
                    <Pressable
                      key={r.code}
                      onPress={() => {
                        setCreatingNew(false);
                        setSelectedCode(r.code);
                      }}
                      style={{ flexShrink: 0 }}
                      className={cn(
                        "px-2.5 py-1 rounded-lg border flex-row items-center gap-1.5",
                        active
                          ? "bg-primary/15 border-primary shadow-xs"
                          : "bg-card border-border hover:bg-panel",
                      )}
                    >
                      <Text className={cn("text-xs font-bold", active ? "text-primary" : "text-foreground")}>
                        {r.name}
                      </Text>
                      <View
                        className={cn(
                          "px-1.5 py-0.5 rounded",
                          r.isSystem ? "bg-muted/70" : "bg-primary/20",
                        )}
                      >
                        <Text className="text-[10px] text-muted-foreground">
                          {r.isSystem ? "Sistem" : "Kustom"}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Form Identitas Role */}
            {creatingNew ? (
              <View className="bg-primary/5 border border-primary/30 rounded-xl p-4 gap-3">
                <View className="flex-row flex-wrap items-center justify-between gap-2">
                  <Text className="text-sm font-bold text-primary">Buat Peran (Role) Kustom Baru</Text>
                  <Button size="sm" variant="ghost" onPress={() => setCreatingNew(false)}>
                    <Text className="text-xs text-muted-foreground">Batal Buat Baru</Text>
                  </Button>
                </View>
                <View className="flex-row flex-wrap gap-3">
                  <View style={{ flex: 1, minWidth: 220 }}>
                    <FormField label="Nama Tampilan Role" required>
                      <Input
                        value={newName}
                        onChangeText={(v) => setNewName(v)}
                        placeholder="Contoh: Supervisor Gudang / Manager Sales"
                      />
                    </FormField>
                  </View>
                  <View style={{ flex: 1, minWidth: 220 }}>
                    <FormField label="Kode Role (Otomatis jika kosong)">
                      <Input
                        value={newCode}
                        onChangeText={(v) => setNewCode(v.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
                        placeholder={
                          newName
                            ? newName.toUpperCase().replace(/[^A-Z0-9_]/g, "_")
                            : "SUPERVISOR_GUDANG"
                        }
                      />
                    </FormField>
                  </View>
                </View>
                <FormField label="Salin Template Awal Dari Role">
                  <View className="flex-row flex-wrap items-center gap-1.5 pt-1">
                    {roles.map((r) => (
                      <Pressable
                        key={r.code}
                        onPress={() => handleCloneTemplateChange(r.code)}
                        className={cn(
                          "px-2.5 py-1.5 rounded-lg border flex-row items-center gap-1",
                          cloneFrom === r.code
                            ? "bg-primary border-primary"
                            : "bg-card border-border",
                        )}
                      >
                        <Copy size={11} color={cloneFrom === r.code ? colors.background : colors.muted} />
                        <Text
                          className={cn(
                            "text-[11px] font-medium",
                            cloneFrom === r.code ? "text-background" : "text-foreground",
                          )}
                        >
                          {r.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </FormField>
                <FormField label="Deskripsi & Tanggung Jawab Peran">
                  <Input
                    value={newDesc}
                    onChangeText={setNewDesc}
                    placeholder="Contoh: Mengawasi stok cabang, menyetujui PR & surat jalan"
                  />
                </FormField>
              </View>
            ) : activeRole ? (
              <View className="bg-panel/60 border border-border rounded-xl p-3.5 gap-3">
                <View className="flex-row flex-wrap items-center justify-between gap-2">
                  <View style={{ flex: 1, minWidth: 220 }}>
                    <Text className="text-sm font-bold text-foreground">
                      {activeRole.name} ({activeRole.code})
                    </Text>
                    <Text className="text-xs text-muted-foreground mt-0.5">
                      {activeRole.description || "Pengaturan hak akses modul dan tindakan pengguna"}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    {activeRole.isSystem && activeRole.code !== "SUPER_ADMIN" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={resetToDefault}
                        className="flex-row items-center gap-1.5 border-border"
                      >
                        <RotateCcw size={12} color={colors.primary} />
                        <Text className="text-xs text-primary font-medium">Reset Default</Text>
                      </Button>
                    ) : null}
                    {!activeRole.isSystem ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={handleDelete}
                        disabled={saving}
                        className="border-danger/50 flex-row items-center gap-1"
                      >
                        <Trash2 size={13} color={colors.danger} />
                        <Text className="text-xs text-danger">Hapus Role</Text>
                      </Button>
                    ) : null}
                  </View>
                </View>
                <View className="flex-row flex-wrap gap-3">
                  <View style={{ flex: 1, minWidth: 220 }}>
                    <FormField label="Nama Tampilan Role">
                      <Input
                        value={draftName}
                        onChangeText={setDraftName}
                        editable={!isSuperAdminSelected}
                      />
                    </FormField>
                  </View>
                  <View style={{ flex: 1, minWidth: 240 }}>
                    <FormField label="Keterangan / Deskripsi Role">
                      <Input
                        value={draftDesc}
                        onChangeText={setDraftDesc}
                        placeholder="Deskripsi singkat hak akses peran ini"
                      />
                    </FormField>
                  </View>
                </View>
              </View>
            ) : null}

            {/* Legenda Kode Hak Akses */}
            <View className="bg-panel/40 border border-border/70 rounded-xl p-3 gap-2">
              <Text className="text-xs font-bold text-foreground">Keterangan Jenis Hak Akses (Granular Permissions):</Text>
              <View className="flex-row flex-wrap gap-2">
                {ACTION_META.map((a) => (
                  <View
                    key={a.code}
                    className="bg-card border border-border/80 rounded-lg px-2.5 py-1.5 flex-row items-center gap-1.5"
                  >
                    <View className="size-5 rounded bg-primary/15 items-center justify-center">
                      <Text className="text-[11px] font-bold text-primary">{a.code}</Text>
                    </View>
                    <View>
                      <Text className="text-[11px] font-bold text-foreground">{a.label}</Text>
                      <Text className="text-[10px] text-muted-foreground">{a.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Matriks Izin Per Kelompok Modul */}
            {MODULE_GROUPS.map((grp) => {
              const groupKeys = grp.items.map((it) => it.key);
              return (
                <View key={grp.group} className="border border-border rounded-xl overflow-hidden bg-card">
                  <View
                    className="bg-panel/80 px-3.5 py-2.5 border-b border-border"
                    style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}
                  >
                    <View style={{ flex: 1, minWidth: 220 }}>
                      <Text className="text-xs sm:text-sm font-bold text-foreground">{grp.group}</Text>
                      <Text className="text-[11px] text-muted-foreground">{grp.subtitle}</Text>
                    </View>
                    {!isSuperAdminSelected ? (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <Pressable
                          onPress={() => setGroupPermissions(groupKeys, "menu")}
                          className="px-2 py-1 rounded-md bg-card border border-border hover:bg-panel"
                        >
                          <Text className="text-[11px] font-medium text-foreground">+ Menu & Lihat</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setGroupPermissions(groupKeys, "view")}
                          className="px-2 py-1 rounded-md bg-card border border-border hover:bg-panel"
                        >
                          <Text className="text-[11px] font-medium text-muted-foreground">+ Lihat Data</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setGroupPermissions(groupKeys, "full")}
                          className="px-2 py-1 rounded-md bg-primary/15 border border-primary/40"
                        >
                          <Text className="text-[11px] font-semibold text-primary">Akses Penuh</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setGroupPermissions(groupKeys, "clear")}
                          className="px-2 py-1 rounded-md bg-card border border-border hover:bg-panel"
                        >
                          <Text className="text-[11px] text-muted-foreground">Kosongkan</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>

                  <View className="divide-y divide-border/60">
                    {grp.items.map((mod) => {
                      const activeActions = isSuperAdminSelected
                        ? ACTION_META.map((a) => a.code)
                        : (draftPerms[mod.key] ?? []);
                      const allChecked = ACTION_META.every((a) => activeActions.includes(a.code));

                      return (
                        <View
                          key={mod.key}
                          className="p-3.5 gap-2.5 hover:bg-panel/20"
                          style={{ flexDirection: "column" }}
                        >
                          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                            <View style={{ flex: 1, minWidth: 240, flexShrink: 0 }}>
                              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                                <Text className="text-xs sm:text-sm font-bold text-foreground">{mod.label}</Text>
                                <View className="bg-panel px-1.5 py-0.5 rounded">
                                  <Text className="text-[10px] font-mono text-muted-foreground">
                                    {mod.key}
                                  </Text>
                                </View>
                              </View>
                              <Text className="text-xs text-muted-foreground mt-0.5" style={{ flexShrink: 0 }}>
                                {mod.desc}
                              </Text>
                            </View>

                            {!isSuperAdminSelected ? (
                              <Pressable
                                onPress={() => toggleAllForModule(mod.key)}
                                style={{ flexShrink: 0 }}
                                className={cn(
                                  "px-2.5 py-1 rounded-lg border",
                                  allChecked
                                    ? "border-primary/40 bg-primary/10"
                                    : "border-border bg-panel/50",
                                )}
                              >
                                <Text
                                  className={cn(
                                    "text-[11px] font-semibold",
                                    allChecked ? "text-primary" : "text-muted-foreground",
                                  )}
                                >
                                  {allChecked ? "Batal Pilih Semua" : "Pilih Semua"}
                                </Text>
                              </Pressable>
                            ) : null}
                          </View>

                          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 5, marginTop: 2 }}>
                            {ACTION_META.map((act) => {
                              const checked = activeActions.includes(act.code);
                              return (
                                <Pressable
                                  key={act.code}
                                  disabled={isSuperAdminSelected}
                                  onPress={() => togglePermission(mod.key, act.code)}
                                  style={{ flexShrink: 0 }}
                                  className={cn(
                                    "px-2 py-1 rounded-md border flex-row items-center gap-1",
                                    checked
                                      ? "bg-primary/15 border-primary"
                                      : "bg-panel/40 border-border/80 opacity-80",
                                  )}
                                >
                                  <View
                                    className={cn(
                                      "size-3.5 rounded items-center justify-center border",
                                      checked ? "bg-primary border-primary" : "border-muted-foreground/50 bg-transparent",
                                    )}
                                  >
                                    {checked ? <Check size={10} color={colors.background} /> : null}
                                  </View>
                                  <Text
                                    className={cn(
                                      "text-[11px] font-semibold",
                                      checked ? "text-primary" : "text-muted-foreground",
                                    )}
                                  >
                                    {act.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        <DialogFooter
          className="pt-2.5 border-t border-border/60 flex-row flex-wrap items-center justify-end gap-2"
          style={{ flexShrink: 0 }}
        >
          <Button variant="outline" size="sm" onPress={() => onOpenChange(false)}>
            <Text className="text-xs">Tutup</Text>
          </Button>
          {!isSuperAdminSelected ? (
            <Button size="sm" onPress={handleSave} disabled={saving}>
              <Text className="text-xs font-semibold">{saving ? "Menyimpan..." : creatingNew ? "Buat & Simpan Role Baru" : "Simpan Perubahan Hak Akses"}</Text>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
