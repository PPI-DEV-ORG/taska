import * as React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  Building2,
  Boxes,
  Layers,
  Radio,
  Truck,
  Warehouse,
  ChevronRight,
  FileSpreadsheet,
  Settings,
  HelpCircle,
  Receipt,
  PieChart,
  Handshake,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { PageHeader } from "@/components/taska/basics";
import { colors } from "@/tokens";
import type { MasterKey } from "../types";

interface MasterCategoriesGridProps {
  data: any;
  user: any;
  onSelectCategory: (cat: MasterKey) => void;
  onOpenImport: () => void;
}

export function MasterCategoriesGrid({
  data,
  user,
  onSelectCategory,
  onOpenImport,
}: MasterCategoriesGridProps) {
  const router = useRouter();

  const ALL_MASTER_CARDS = [
    {
      id: "customer" as MasterKey,
      title: "Master Customer",
      desc: "Data klien, perusahaan, kontak PIC, dan status keaktifan",
      count: `${data.customers?.length || 0} Klien`,
      icon: Building2,
      tag: "Dikelola Sales",
      roles: ["admin", "bos", "sales"],
      onPress: () => router.push("/customers"),
    },
    {
      id: "sumber-lead" as MasterKey,
      title: "Sumber Lead (Lead Source)",
      desc: "Kanal rujukan prospek (Website, Referral, Event, Distributor)",
      count: `${data.leadSources?.length || 0} Kanal`,
      icon: Radio,
      tag: "Dikelola Sales",
      roles: ["admin", "bos", "sales"],
      onPress: () => onSelectCategory("sumber-lead"),
    },
    {
      id: "alasan-lost" as MasterKey,
      title: "Alasan Lost (Gagal Deal)",
      desc: "Daftar alasan wajib saat lead ditandai Lost (Harga, Kompetitor, Batal)",
      count: `${data.lostReasons?.length || 0} Alasan`,
      icon: HelpCircle,
      tag: "Dikelola Sales",
      roles: ["admin", "bos", "sales"],
      onPress: () => onSelectCategory("alasan-lost"),
    },
    {
      id: "jenis-kunjungan" as MasterKey,
      title: "Jenis Aktivitas Kunjungan",
      desc: "Kategori kunjungan & meeting (Demo, Negosiasi, Koordinasi, MoM)",
      count: `${(data["visit-activity-types"]?.length || 0)} Jenis`,
      icon: Handshake,
      tag: "Dikelola Sales & PM",
      roles: ["admin", "bos", "sales", "pm"],
      onPress: () => onSelectCategory("jenis-kunjungan"),
    },
    {
      id: "supplier" as MasterKey,
      title: "Master Supplier",
      desc: "Daftar vendor penyedia barang, syarat pembayaran & tempo",
      count: `${data.suppliers?.length || 0} Supplier`,
      icon: Truck,
      tag: "Dikelola Procurement",
      roles: ["admin", "bos", "procurement"],
      onPress: () => router.push("/suppliers"),
    },
    {
      id: "gudang" as MasterKey,
      title: "Daftar Gudang",
      desc: "Lokasi gudang fisik, kota, dan penanggung jawab inventori",
      count: `${data.warehouses?.length || 0} Gudang`,
      icon: Warehouse,
      tag: "Dikelola Admin & Procurement",
      roles: ["admin", "bos", "procurement"],
      onPress: () => onSelectCategory("gudang"),
    },
    {
      id: "barang" as MasterKey,
      title: "Master Barang & Produk",
      desc: "Katalog master SKU, kategori, unit satuan, garansi & tipe SN",
      count: `${data.products?.length || 0} Barang`,
      icon: Boxes,
      tag: "Dikelola Gudang",
      roles: ["admin", "bos", "gudang", "procurement", "pm"],
      onPress: () => onSelectCategory("barang"),
    },
    {
      id: "kategori-barang" as MasterKey,
      title: "Master Kategori Produk",
      desc: "Klasifikasi kelompok produk, SKU prefix, dan deskripsi kategori",
      count: `${data.productCategories?.length || 0} Kategori`,
      icon: Layers,
      tag: "Dikelola Gudang",
      roles: ["admin", "bos", "gudang", "procurement", "pm"],
      onPress: () => onSelectCategory("kategori-barang"),
    },
    {
      id: "kategori-pengeluaran" as MasterKey,
      title: "Kategori Pengeluaran & Biaya",
      desc: "Pos klasifikasi biaya operasional (Bensin, Makan, Perlengkapan)",
      count: `${data.expenseCategories?.length || 0} Pos Biaya`,
      icon: Receipt,
      tag: "Dikelola Finance",
      roles: ["admin", "bos", "finance"],
      onPress: () => onSelectCategory("kategori-pengeluaran"),
    },
    {
      id: "cost-center" as MasterKey,
      title: "Cost Center (Pusat Biaya)",
      desc: "Klasifikasi alokasi anggaran departemen dan project",
      count: `${data.costCenters?.length || 0} Cost Center`,
      icon: PieChart,
      tag: "Dikelola Finance",
      roles: ["admin", "bos", "finance"],
      onPress: () => onSelectCategory("cost-center"),
    },
    {
      id: "pengaturan-sistem" as MasterKey,
      title: "Pengaturan Kebijakan ERP",
      desc: "Ambang batas persetujuan Bos, tarif PPN 11%, format penomoran",
      count: "Sistem",
      icon: Settings,
      tag: "Dikelola Admin / Bos",
      roles: ["admin", "bos"],
      onPress: () => onSelectCategory("pengaturan-sistem"),
    },
  ];

  const visibleCards = ALL_MASTER_CARDS.filter((card) =>
    user ? user.role === "super_admin" || card.roles.includes(user.role) : false
  );

  return (
    <View className="gap-6 w-full">
      <PageHeader
        title="Master Data"
        subtitle="Pilih kategori master data untuk melihat dan mengelola tabel rujukan sistem"
        action={
          <Button
            variant="outline"
            size="sm"
            onPress={onOpenImport}
            className="flex-row items-center gap-1.5"
          >
            <FileSpreadsheet size={15} color={colors.success} />
            <Text className="text-xs">Import Excel / CSV</Text>
          </Button>
        }
      />

      <View className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
        {visibleCards.map((card) => {
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

