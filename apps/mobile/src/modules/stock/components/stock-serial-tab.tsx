import * as React from "react";
import { DataTable } from "@/components/taska/data-table";
import type { DetailTarget } from "../types";

interface StockSerialTabProps {
  filteredSerials: any[];
  onSelectDetail: (target: DetailTarget) => void;
}

export function StockSerialTab({
  filteredSerials,
  onSelectDetail,
}: StockSerialTabProps) {
  return (
    <DataTable
      columns={[
        { key: "sn", label: "Serial Number", primary: true, flex: 1.5 },
        { key: "produk", label: "Produk", flex: 1.6 },
        { key: "gudang", label: "Lokasi Gudang", flex: 1.2 },
        { key: "project", label: "Alokasi Project", flex: 1.4 },
        { key: "garansiDisplay", label: "Masa Garansi", flex: 1.2 },
        { key: "status", label: "Status Unit", fmt: "status", flex: 1 },
      ]}
      rows={filteredSerials.map((s) => ({
        ...s,
        garansiDisplay: s.garansiBerakhir || s.garansiMulai || "-",
      }))}
      pageSize={8}
      onRowPress={(s) => onSelectDetail({ type: "serial", data: s })}
    />
  );
}

