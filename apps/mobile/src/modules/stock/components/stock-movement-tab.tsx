import * as React from "react";
import { DataTable } from "@/components/taska/data-table";
import type { DetailTarget } from "../types";

interface StockMovementTabProps {
  filteredMovements: any[];
  onSelectDetail: (target: DetailTarget) => void;
}

export function StockMovementTab({
  filteredMovements,
  onSelectDetail,
}: StockMovementTabProps) {
  return (
    <DataTable
      columns={[
        { key: "produk", label: "Nama Barang", primary: true, flex: 1.8 },
        { key: "kategori", label: "Kategori Mutasi", flex: 1.3 },
        { key: "gudang", label: "Gudang", flex: 1.2 },
        { key: "project", label: "Project", flex: 1.3 },
        { key: "qtyDisplay", label: "Jumlah", flex: 0.9 },
        { key: "waktu", label: "Tanggal Mutasi", flex: 1.2 },
        { key: "jenis", label: "Jenis Mutasi", fmt: "status", flex: 1 },
      ]}
      rows={filteredMovements.map((m) => ({
        ...m,
        qtyDisplay: `${m.qty ?? 0} unit`,
      }))}
      pageSize={8}
      onRowPress={(m) => onSelectDetail({ type: "movement", data: m })}
    />
  );
}

