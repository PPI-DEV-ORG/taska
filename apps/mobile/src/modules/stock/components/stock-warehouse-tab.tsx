import * as React from "react";
import { View } from "react-native";
import { Chip } from "@/components/taska/basics";
import { DataTable } from "@/components/taska/data-table";
import type { DetailTarget } from "../types";

interface StockWarehouseTabProps {
  warehouses: any[];
  filteredProducts: any[];
  selectedWarehouse: string;
  setSelectedWarehouse: (wh: string) => void;
  selectedWarehouseRow: any;
  summaryOfProductWarehouse: (productId: string, warehouseId: string) => any;
  saldoOfProduct: (productId: string) => number;
  onSelectDetail: (target: DetailTarget) => void;
}

export function StockWarehouseTab({
  warehouses,
  filteredProducts,
  selectedWarehouse,
  setSelectedWarehouse,
  selectedWarehouseRow,
  summaryOfProductWarehouse,
  saldoOfProduct,
  onSelectDetail,
}: StockWarehouseTabProps) {
  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap gap-2">
        {warehouses.map((w) => (
          <Chip
            key={w.id}
            label={String(w.nama)}
            active={(selectedWarehouse || warehouses[0]?.nama) === w.nama}
            onPress={() => setSelectedWarehouse(String(w.nama))}
          />
        ))}
      </View>

      <DataTable
        columns={[
          { key: "nama", label: "Nama Barang", primary: true, flex: 1.8 },
          { key: "merkDisplay", label: "Merk", flex: 0.9 },
          { key: "sku", label: "SKU", flex: 1 },
          { key: "tipeSN", label: "Tipe", flex: 0.9 },
          { key: "masukDisplay", label: "Masuk", flex: 0.9 },
          { key: "keluarDisplay", label: "Keluar", flex: 0.9 },
          { key: "transferInDisplay", label: "Transfer Masuk", flex: 1.1 },
          { key: "transferOutDisplay", label: "Transfer Keluar", flex: 1.1 },
          { key: "saldo", label: "Saldo Akhir", flex: 1.1 },
          { key: "statusStok", label: "Status", fmt: "status", flex: 1 },
        ]}
        rows={filteredProducts.map((p) => {
          const sRow = summaryOfProductWarehouse(String(p.id), String(selectedWarehouseRow?.id ?? ""));
          const qty = Number(sRow?.saldo ?? 0);
          const total = saldoOfProduct(String(p.id));
          return {
            ...p,
            merkDisplay: p.merk || p.brand || "-",
            tipeSN: p.berSN ? "Serial" : "Curah",
            gudang: selectedWarehouseRow?.nama ?? selectedWarehouse,
            masukDisplay: `${sRow?.masuk ?? 0}`,
            keluarDisplay: `${sRow?.keluar ?? 0}`,
            transferInDisplay: `${sRow?.transferMasuk ?? 0}`,
            transferOutDisplay: `${sRow?.transferKeluar ?? 0}`,
            saldo: `${qty} ${p.satuan ?? ""}`,
            statusStok: total < Number(p.min ?? 0) ? "Stok Menipis" : "Tersedia",
          };
        })}
        pageSize={8}
        onRowPress={(wp) => onSelectDetail({ type: "warehouse_product", data: wp })}
      />
    </View>
  );
}

