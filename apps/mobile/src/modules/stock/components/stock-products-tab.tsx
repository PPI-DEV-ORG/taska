import * as React from "react";
import { View } from "react-native";
import { Chip } from "@/components/taska/basics";
import { DataTable } from "@/components/taska/data-table";
import { rupiah } from "@/lib/format";
import type { DetailTarget } from "../types";

interface StockProductsTabProps {
  products: any[];
  filteredProducts: any[];
  itemFilter: "all" | "sn" | "non-sn" | "jasa";
  setItemFilter: (filter: "all" | "sn" | "non-sn" | "jasa") => void;
  saldoOfProduct: (productId: string) => number;
  onSelectDetail: (target: DetailTarget) => void;
}

export function StockProductsTab({
  products,
  filteredProducts,
  itemFilter,
  setItemFilter,
  saldoOfProduct,
  onSelectDetail,
}: StockProductsTabProps) {
  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap items-center gap-2">
        <Chip
          label={`Semua (${products.length})`}
          active={itemFilter === "all"}
          onPress={() => setItemFilter("all")}
        />
        <Chip
          label={`Barang Ber-SN (${products.filter((p) => p.type !== "JASA" && p.berSN).length})`}
          active={itemFilter === "sn"}
          onPress={() => setItemFilter("sn")}
        />
        <Chip
          label={`Barang Non-SN (${products.filter((p) => p.type !== "JASA" && !p.berSN).length})`}
          active={itemFilter === "non-sn"}
          onPress={() => setItemFilter("non-sn")}
        />
        <Chip
          label={`Jasa (${products.filter((p) => p.type === "JASA").length})`}
          active={itemFilter === "jasa"}
          onPress={() => setItemFilter("jasa")}
        />
      </View>
      <DataTable
        columns={[
          { key: "nama", label: "Nama Barang / Jasa", primary: true, flex: 1.8 },
          { key: "sku", label: "SKU / Kode", flex: 1 },
          { key: "tipeDisplay", label: "Tipe Item", flex: 1.1 },
          { key: "kategori", label: "Kategori", flex: 1 },
          { key: "totalDisplay", label: "Total Stok / Tarif", flex: 1.2 },
          { key: "minDisplay", label: "Batas Min", flex: 0.9 },
          { key: "statusStok", label: "Status", fmt: "status", flex: 1 },
        ]}
        rows={filteredProducts.map((p) => {
          const isJasa = p.type === "JASA" || p.jenisItem === "Jasa";
          const total = saldoOfProduct(String(p.id));
          const satuan = String(p.satuan ?? "");
          return {
            ...p,
            tipeDisplay: isJasa ? "Jasa" : p.berSN ? "Barang Ber-SN" : "Barang Non-SN",
            totalDisplay: isJasa ? `${rupiah(p.hargaBeli || 0)} / ${satuan || "lot"}` : `${total} ${satuan}`,
            minDisplay: isJasa ? "-" : `${p.min ?? 0} ${satuan}`,
            statusStok: isJasa ? "Aktif" : total < Number(p.min ?? 0) ? "Stok Menipis" : "Tersedia",
          };
        })}
        pageSize={8}
        onRowPress={(p) => onSelectDetail({ type: "product", data: p })}
      />
    </View>
  );
}

