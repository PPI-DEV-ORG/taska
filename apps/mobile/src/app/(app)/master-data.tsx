import * as React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Building2,
  Boxes,
  Database,
  Layers,
  MapPin,
  Plus,
  Radio,
  Truck,
  Warehouse,
  ChevronRight,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { useApp } from "@/store/app-store";
import {
  CUSTOMERS,
  SUPPLIERS,
  PRODUCTS,
  WAREHOUSES,
  LEAD_SOURCES,
} from "@/mock/data";
import { DataTable } from "@/components/taska/data-table";
import { colors } from "@/tokens";

type MasterKey = "customer" | "supplier" | "barang" | "gudang" | "sumber-lead";

export default function MasterDataScreen() {
  const router = useRouter();
  const { data, user } = useApp();
  const [selectedCategory, setSelectedCategory] = React.useState<MasterKey | null>(null);

  // Jika sedang melihat detail salah satu master data
  if (selectedCategory === "barang") {
    return (
      <View className="gap-5">
        <PageHeader
          back
          title="Master Produk & Barang"
          subtitle={`${PRODUCTS.length} barang terdaftar`}
          action={
            <View className="flex-row gap-2">
              <Button variant="outline" size="sm" onPress={() => setSelectedCategory(null)}>
                <ArrowLeft size={15} color={colors.text} />
                <Text className="text-xs">Kembali ke Menu</Text>
              </Button>
              <Button size="sm" onPress={() => router.push("/stock")}>
                <Text className="text-xs">Buka Stok Gudang</Text>
              </Button>
            </View>
          }
        />
        <DataTable
          columns={[
            { key: "nama", label: "Nama Produk / Barang", primary: true, flex: 1.8 },
            { key: "sku", label: "SKU", flex: 1 },
            { key: "kategori", label: "Kategori", flex: 1 },
            { key: "satuan", label: "Satuan", flex: 0.8 },
            { key: "garansi", label: "Garansi", flex: 1 },
            { key: "tipeSN", label: "Tipe SN", flex: 1 },
          ]}
          rows={PRODUCTS.map((p) => ({
            ...p,
            tipeSN: p.berSN ? "Serial Number" : "Non-SN",
          }))}
          pageSize={8}
        />
      </View>
    );
  }

  if (selectedCategory === "gudang") {
    return (
      <View className="gap-5">
        <PageHeader
          back
          title="Daftar Gudang Perusahaan"
          subtitle={`${WAREHOUSES.length} lokasi gudang operasional`}
          action={
            <Button variant="outline" size="sm" onPress={() => setSelectedCategory(null)}>
              <ArrowLeft size={15} color={colors.text} />
              <Text className="text-xs">Kembali ke Menu</Text>
            </Button>
          }
        />
        <DataTable
          columns={[
            { key: "nama", label: "Nama Gudang", primary: true, flex: 1.6 },
            { key: "kota", label: "Lokasi Kota", flex: 1.2 },
            { key: "staf", label: "Staf Penanggung Jawab", flex: 1.5 },
            { key: "status", label: "Status Operasional", fmt: "status", flex: 1 },
          ]}
          rows={WAREHOUSES}
          pageSize={8}
        />
      </View>
    );
  }

  if (selectedCategory === "sumber-lead") {
    return (
      <View className="gap-5">
        <PageHeader
          back
          title="Sumber Kedatangan Lead"
          subtitle={`${LEAD_SOURCES.length} kanal akuisisi marketing`}
          action={
            <Button variant="outline" size="sm" onPress={() => setSelectedCategory(null)}>
              <ArrowLeft size={15} color={colors.text} />
              <Text className="text-xs">Kembali ke Menu</Text>
            </Button>
          }
        />
        <DataTable
          columns={[
            { key: "nama", label: "Kanal Sumber Lead", primary: true, flex: 2 },
            { key: "status", label: "Status", fmt: "status", flex: 1 },
          ]}
          rows={LEAD_SOURCES.map((ls, idx) => ({
            id: `LS-${idx + 1}`,
            nama: ls,
            status: "Aktif",
          }))}
          pageSize={8}
        />
      </View>
    );
  }

  // Grid/Cards Menu Awal Master Data
  const MASTER_CARDS = [
    {
      id: "customer" as MasterKey,
      title: "Master Customer",
      desc: "Data klien, perusahaan, kontak PIC, dan status keaktifan",
      count: `${data.customers.length} Klien`,
      icon: Building2,
      tag: "Dikelola Sales",
      onPress: () => router.push("/customers"),
    },
    {
      id: "supplier" as MasterKey,
      title: "Master Supplier",
      desc: "Daftar vendor penyedia barang, syarat pembayaran & tempo",
      count: `${data.suppliers.length} Supplier`,
      icon: Truck,
      tag: "Dikelola Procurement",
      onPress: () => router.push("/suppliers"),
    },
    {
      id: "barang" as MasterKey,
      title: "Master Barang & Produk",
      desc: "Katalog master SKU, kategori, unit satuan, garansi & tipe SN",
      count: `${PRODUCTS.length} Barang`,
      icon: Boxes,
      tag: "Dikelola Gudang",
      onPress: () => setSelectedCategory("barang"),
    },
    {
      id: "gudang" as MasterKey,
      title: "Daftar Gudang",
      desc: "Lokasi gudang fisik, kota, dan penanggung jawab inventori",
      count: `${WAREHOUSES.length} Gudang`,
      icon: Warehouse,
      tag: "Dikelola Admin",
      onPress: () => setSelectedCategory("gudang"),
    },
    {
      id: "sumber-lead" as MasterKey,
      title: "Sumber Lead (Lead Source)",
      desc: "Kanal rujukan prospek (Website, Referral, Event, Distributor)",
      count: `${LEAD_SOURCES.length} Kanal`,
      icon: Radio,
      tag: "Dikelola Sales",
      onPress: () => setSelectedCategory("sumber-lead"),
    },
  ];

  return (
    <View className="gap-6 w-full">
      <PageHeader
        title="Master Data"
        subtitle="Pilih kategori master data untuk melihat dan mengelola tabel rujukan sistem"
      />

      <View className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
        {MASTER_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Pressable
              key={card.id}
              onPress={card.onPress}
              className="bg-card hover:bg-panel border-border/80 active:bg-panel flex-col justify-between rounded-2xl border p-5 transition-colors shadow-sm min-h-[160px] gap-4"
            >
              <View className="flex-row items-start justify-between gap-3">
                <View className="bg-panel border-border/60 size-11 items-center justify-center rounded-xl border">
                  <Icon size={22} color={colors.primary} />
                </View>
                <View className="bg-panel rounded-full px-2.5 py-1 border border-border/60">
                  <Text className="text-[11px] font-semibold text-muted-foreground">{card.count}</Text>
                </View>
              </View>

              <View className="gap-1 flex-1">
                <Text className="text-base font-bold text-foreground">{card.title}</Text>
                <Text className="text-muted-foreground text-xs leading-relaxed">{card.desc}</Text>
              </View>

              <View className="flex-row items-center justify-between border-t border-border/40 pt-3">
                <Text className="text-[11px] font-medium text-text-secondary">{card.tag}</Text>
                <View className="flex-row items-center gap-1">
                  <Text className="text-primary text-xs font-semibold">Buka Tabel</Text>
                  <ChevronRight size={14} color={colors.primary} />
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
