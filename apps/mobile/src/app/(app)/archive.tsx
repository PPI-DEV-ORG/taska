import * as React from "react";
import { View, ScrollView } from "react-native";
import { Archive, Search } from "lucide-react-native";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel, Chip, EmptyState } from "@/components/taska/basics";
import { DataTable } from "@/components/taska/data-table";
import { StatusBadge } from "@/components/taska/status-badge";
import { colors } from "@/tokens";

const ARCHIVE_CATEGORIES = [
  "Leads",
  "Penawaran",
  "Invoice",
  "Project",
  "Stok",
  "Surat Jalan",
  "Pengeluaran",
] as const;

const ARCHIVE_SAMPLE = [
  { id: "ARC-01", tahun: "2024", cat: "Project", title: "CCTV Gedung Arsip Nasional 2024", ref: "P-2024-009", status: "Selesai" },
  { id: "ARC-02", tahun: "2023", cat: "Invoice", title: "INV/2023/11/044 - Pelunasan DP", ref: "Rp 140.000.000", status: "Lunas" },
  { id: "ARC-03", tahun: "2024", cat: "Surat Jalan", title: "SJ/2024/05/110 - Pengiriman NVR Surabaya", ref: "Eko Saputra", status: "Diterima" },
  { id: "ARC-04", tahun: "2023", cat: "Leads", title: "Tender Server RSUD Bekasi", ref: "CV Karya Mandiri", status: "Won" },
  { id: "ARC-05", tahun: "2023", cat: "Pengeluaran", title: "Bensin & Tol Survey Semarang 2023", ref: "Rp 850.000", status: "Dibayar" },
];

export default function ArchiveScreen() {
  const [activeCat, setActiveCat] = React.useState<string>("Semua");
  const [selectedYear, setSelectedYear] = React.useState("Semua");
  const [query, setQuery] = React.useState("");

  const filtered = ARCHIVE_SAMPLE.filter(
    (item) =>
      (activeCat === "Semua" || item.cat === activeCat) &&
      (selectedYear === "Semua" || item.tahun === selectedYear) &&
      (!query || item.title.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <View className="gap-5">
      <PageHeader
        title="Arsip Data Lama (Archive)"
        subtitle="Data berumur lebih dari 2 tahun yang dipindahkan secara aman (Read-Only)"
      />

      <View className="gap-3">
        {/* Kategori Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          <Chip label="Semua Kategori" active={activeCat === "Semua"} onPress={() => setActiveCat("Semua")} />
          {ARCHIVE_CATEGORIES.map((c) => (
            <Chip key={c} label={c} active={activeCat === c} onPress={() => setActiveCat(c)} />
          ))}
        </ScrollView>

        {/* Tahun Filter */}
        <View className="flex-row items-center gap-2">
          <Text className="text-muted-foreground text-xs">Filter Tahun:</Text>
          {["Semua", "2024", "2023", "2022"].map((y) => (
            <Chip key={y} label={y} active={selectedYear === y} onPress={() => setSelectedYear(y)} />
          ))}
        </View>

        {/* Search */}
        <View className="bg-input border-border h-11 flex-row items-center gap-2 rounded-lg border px-3">
          <Search size={16} color={colors.muted} />
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Cari dalam arsip dokumen lama"
            className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none"
          />
        </View>
      </View>

      <DataTable
        columns={[
          { key: "tahun", label: "Tahun", flex: 0.8 },
          { key: "cat", label: "Kategori", flex: 1 },
          { key: "title", label: "Dokumen / Judul Arsip", primary: true, flex: 2 },
          { key: "ref", label: "Referensi / Nilai", flex: 1.2 },
          { key: "status", label: "Status Terakhir", fmt: "status", flex: 1 },
        ]}
        rows={filtered}
        pageSize={8}
      />
    </View>
  );
}
