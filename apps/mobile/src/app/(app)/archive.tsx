import * as React from "react";
import { View, ScrollView } from "react-native";
import { Search } from "lucide-react-native";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { PageHeader, Chip } from "@/components/taska/basics";
import { DataTable } from "@/components/taska/data-table";
import { StatusBadge } from "@/components/taska/status-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api";
import { rupiah } from "@/lib/format";
import { colors } from "@/tokens";

const ARCHIVE_CATEGORIES = [
  "Leads",
  "Penawaran",
  "Invoice",
  "Project",
  "Mutasi Stok",
  "Surat Jalan",
  "Pengeluaran",
] as const;

export default function ArchiveScreen() {
  const [activeCat, setActiveCat] = React.useState<string>("Semua");
  const [selectedYear, setSelectedYear] = React.useState("Semua");
  const [query, setQuery] = React.useState("");
  const [apiRows, setApiRows] = React.useState<any[]>([]);
  const [selectedArchive, setSelectedArchive] = React.useState<any | null>(null);

  const fetchArchive = React.useCallback(async () => {
    try {
      const res = await api<{ items: any[] }>("GET", "/reports/archive");
      if (Array.isArray(res?.items)) {
        setApiRows(
          res.items.map((r) => ({
            id: r.id,
            tahun: r.year,
            cat: r.category,
            title: r.title,
            ref: r.value > 0 ? rupiah(r.value) : r.client,
            status: r.status,
            raw: r,
          })),
        );
      }
    } catch {}
  }, []);

  React.useEffect(() => {
    let active = true;
    api<{ items: any[] }>("GET", "/reports/archive")
      .then((res) => {
        if (active && Array.isArray(res?.items)) {
          setApiRows(
            res.items.map((r) => ({
              id: r.id,
              tahun: r.year,
              cat: r.category,
              title: r.title,
              ref: r.value > 0 ? rupiah(r.value) : r.client,
              status: r.status,
              raw: r,
            })),
          );
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const filtered = apiRows.filter(
    (item) =>
      (activeCat === "Semua" || item.cat === activeCat) &&
      (selectedYear === "Semua" || item.tahun === selectedYear) &&
      (!query || item.title.toLowerCase().includes(query.toLowerCase()) || String(item.ref).toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <View className="gap-5">
      <PageHeader
        title="Arsip Data Lama (Archive)"
        subtitle="Data berumur lebih dari 2 tahun yang dipindahkan secara aman (Read-Only)"
        onRefresh={fetchArchive}
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
        onRowPress={(row) => setSelectedArchive(row)}
      />

      {/* Modal Detail Arsip */}
      <Dialog open={!!selectedArchive} onOpenChange={(v) => !v && setSelectedArchive(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Arsip Dokumen</DialogTitle>
          </DialogHeader>

          {selectedArchive && (
            <View className="gap-4 py-2">
              <View className="flex-row items-center justify-between border-b border-border pb-3">
                <View className="flex-1 pr-2">
                  <Text className="text-base font-bold text-foreground">{selectedArchive.title}</Text>
                  <Text className="text-xs text-muted-foreground">Kategori: {selectedArchive.cat} • Tahun: {selectedArchive.tahun}</Text>
                </View>
                <StatusBadge status={selectedArchive.status ?? "Selesai"} />
              </View>

              <View className="bg-card border-border space-y-2 rounded-lg border p-3">
                <View className="flex-row justify-between py-1 border-b border-border">
                  <Text className="text-xs text-muted-foreground">ID Arsip</Text>
                  <Text className="font-mono text-xs text-foreground">{selectedArchive.id}</Text>
                </View>
                <View className="flex-row justify-between py-1 border-b border-border">
                  <Text className="text-xs text-muted-foreground">Tahun Arsip</Text>
                  <Text className="text-xs font-semibold text-foreground">{selectedArchive.tahun}</Text>
                </View>
                <View className="flex-row justify-between py-1 border-b border-border">
                  <Text className="text-xs text-muted-foreground">Referensi / Nilai</Text>
                  <Text className="text-xs font-bold text-primary">{selectedArchive.ref || "-"}</Text>
                </View>
                <View className="flex-row justify-between py-1">
                  <Text className="text-xs text-muted-foreground">Status Dokumen</Text>
                  <Text className="text-xs font-semibold text-foreground">{selectedArchive.status || "-"}</Text>
                </View>
              </View>

              <View className="rounded-lg bg-muted/40 p-3">
                <Text className="text-xs text-muted-foreground">
                  Catatan: Data ini telah diarsipkan dan berstatus Read-Only karena berusia lebih dari 2 tahun.
                </Text>
              </View>
            </View>
          )}

          <DialogFooter>
            <Button variant="outline" onPress={() => setSelectedArchive(null)}>
              <Text>Tutup</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}
