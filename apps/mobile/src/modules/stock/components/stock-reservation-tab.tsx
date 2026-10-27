import * as React from "react";
import { DataTable } from "@/components/taska/data-table";
import type { DetailTarget } from "../types";

interface StockReservationTabProps {
  filteredReservations: any[];
  onSelectDetail: (target: DetailTarget) => void;
}

export function StockReservationTab({
  filteredReservations,
  onSelectDetail,
}: StockReservationTabProps) {
  return (
    <DataTable
      columns={[
        { key: "produk", label: "Nama Barang", primary: true, flex: 1.8 },
        { key: "project", label: "Project Pemesan", flex: 1.6 },
        { key: "sn", label: "Serial Number", flex: 1.2 },
        { key: "qtyDisplay", label: "Jumlah Ditahan", flex: 1.1 },
        { key: "status", label: "Status Alokasi", fmt: "status", flex: 1 },
      ]}
      rows={filteredReservations.map((r) => ({
        ...r,
        qtyDisplay: `${r.qty ?? 0} unit`,
        status: r.status === "Dirilis" ? "Selesai" : "Reserved",
      }))}
      pageSize={8}
      onRowPress={(r) => onSelectDetail({ type: "reservation", data: r })}
    />
  );
}

