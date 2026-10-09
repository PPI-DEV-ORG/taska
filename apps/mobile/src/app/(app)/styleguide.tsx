import * as React from "react";
import { View, ScrollView } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel, KpiCard, EmptyState } from "@/components/taska/basics";
import { StatusBadge, ALL_STATUSES } from "@/components/taska/status-badge";
import { colors, chartSeries } from "@/tokens";

const COLOR_SWATCHES = [
  { name: "Background", hex: colors.background, desc: "Latar utama aplikasi" },
  { name: "Card / Sidebar", hex: colors.card, desc: "Latar panel, kartu, tabel" },
  { name: "Panel / Input", hex: colors.panel, desc: "Latar input dan kontrol" },
  { name: "Border", hex: colors.border, desc: "Garis batas 1px redup" },
  { name: "Primary (Oranye)", hex: colors.primary, desc: "Aksen aksi utama Taska" },
  { name: "Primary Hover", hex: colors.primaryHover, desc: "State hover tombol utama" },
  { name: "Primary Pressed", hex: colors.primaryPressed, desc: "State tekan tombol utama" },
  { name: "Text Utama", hex: colors.text, desc: "Kontras tinggi untuk keterbacaan" },
  { name: "Text Sekunder", hex: colors.textSecondary, desc: "Label dan teks penjelas" },
  { name: "Text Muted", hex: colors.muted, desc: "Placeholder & info pendukung" },
  { name: "Success", hex: colors.success, desc: "Status berhasil, lunas, won" },
  { name: "Warning", hex: colors.warning, desc: "Menunggu persetujuan, jatuh tempo" },
  { name: "Danger", hex: colors.danger, desc: "Ditolak, terlambat, rusak" },
  { name: "Info", hex: colors.info, desc: "Proses berjalan, dikirim, survey" },
];

export default function StyleguideScreen() {
  return (
    <View className="gap-6">
      <PageHeader
        back
        title="Panduan Gaya UI (Taska Design System)"
        subtitle="Dokumentasi token warna mode gelap, tipografi, dan varian StatusBadge"
      />

      {/* 1. Token Warna */}
      <Panel title="1. Token Warna (Mode Gelap Saja)" subtitle="Sistem warna profesional tanpa gradien dan tanpa bayangan tebal">
        <View className="flex-row flex-wrap gap-3">
          {COLOR_SWATCHES.map((c) => (
            <View key={c.name} className="bg-panel/40 border-border min-w-[200px] flex-1 rounded-xl border p-3 gap-2">
              <View className="h-10 rounded-lg border border-white/10" style={{ backgroundColor: c.hex }} />
              <View>
                <Text className="text-sm font-semibold">{c.name}</Text>
                <Text className="text-primary font-mono text-xs">{c.hex}</Text>
                <Text className="text-muted-foreground text-xs mt-0.5">{c.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </Panel>

      {/* Seri Warna Chart */}
      <Panel title="Seri Warna Chart (Maksimal 5 Seri)">
        <View className="flex-row gap-2">
          {chartSeries.map((hex, i) => (
            <View key={hex} className="items-center gap-1 flex-1">
              <View className="h-8 w-full rounded" style={{ backgroundColor: hex }} />
              <Text className="text-[10px] text-muted-foreground font-mono">{hex}</Text>
            </View>
          ))}
        </View>
      </Panel>

      {/* 2. Semua Varian StatusBadge */}
      <Panel
        title="2. Semua Varian StatusBadge"
        subtitle="Warna status 15% opacity + ikon Lucide + teks berwarna. Tidak boleh hanya warna."
      >
        <View className="flex-row flex-wrap gap-2.5">
          {ALL_STATUSES.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </View>
      </Panel>

      {/* 3. Komponen Tombol & Aksi */}
      <Panel title="3. Tombol & Komponen Aksi" subtitle="Satu aksi utama (oranye teks gelap), tombol sekunder, dan outline">
        <View className="flex-row flex-wrap gap-3 items-center">
          <Button size="lg"><Text>Tombol Utama (Lg)</Text></Button>
          <Button><Text>Tombol Standar</Text></Button>
          <Button size="sm"><Text>Tombol Kecil</Text></Button>
          <Button variant="outline"><Text>Tombol Outline</Text></Button>
          <Button variant="secondary"><Text>Tombol Secondary</Text></Button>
          <Button variant="destructive"><Text>Tombol Bahaya</Text></Button>
          <Button variant="ghost"><Text>Tombol Ghost</Text></Button>
        </View>
      </Panel>

      {/* 4. Tipografi & Input */}
      <Panel title="4. Tipografi & Form Input">
        <View className="gap-3 max-w-md">
          <Text className="text-2xl font-bold">Judul Halaman (24px Bold)</Text>
          <Text className="text-lg font-semibold">Subjudul Panel (18px Semibold)</Text>
          <Text className="text-base text-text">Teks Isi Reguler (16px / 14px Kontras Tinggi)</Text>
          <Text className="text-sm text-text-secondary">Teks Sekunder Keterangan (14px)</Text>
          <Text className="text-xs text-muted-foreground">Teks Muted / Catatan Kaki (12px)</Text>

          <View className="mt-2 gap-2">
            <Input placeholder="Contoh input teks aktif" />
            <Input placeholder="Input nonaktif" editable={false} value="Nilai terkunci" />
          </View>
        </View>
      </Panel>
    </View>
  );
}
