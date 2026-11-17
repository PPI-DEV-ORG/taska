import type { Row } from "@/constants/modules";
import { mapLeads, mapQuotations, mapSurveys } from "./crm";
import { mapPoClient, mapInvoices, mapProjects, mapTasks } from "./sales";
import {
  mapPurchaseRequests,
  mapSupplierPos,
  mapReceiving,
} from "./procurement";
import { mapDeliveryNotes } from "./delivery";
import { mapExpenses, mapInvoiceIn } from "./finance";
import {
  mapPocReports,
  mapVisitReports,
  mapMaintenanceReports,
  mapDamageReports,
} from "./operations";
import {
  mapCustomers,
  mapSuppliers,
  mapUsers,
  mapAuditLog,
  mapOpname,
  mapWarehouses,
  mapProducts,
  mapProductCategories,
  mapLeadSourcesGroup,
} from "./master-data";
import {
  mapSerials,
  mapMovements,
  mapReservations,
  mapFollowups,
} from "./inventory";

type RowMapper = (raw: any, base: Row) => Row;

const ROW_MAPPERS: Record<string, RowMapper> = {
  leads: mapLeads,
  quotations: mapQuotations,
  surveys: mapSurveys,
  "po-client": mapPoClient,
  invoices: mapInvoices,
  projects: mapProjects,
  tasks: mapTasks,
  "purchase-requests": mapPurchaseRequests,
  "supplier-pos": mapSupplierPos,
  receiving: mapReceiving,
  "delivery-notes": mapDeliveryNotes,
  expenses: mapExpenses,
  invoiceIn: mapInvoiceIn,
  "poc-reports": mapPocReports,
  "visit-reports": mapVisitReports,
  "maintenance-reports": mapMaintenanceReports,
  "damage-reports": mapDamageReports,
  customers: mapCustomers,
  suppliers: mapSuppliers,
  users: mapUsers,
  "audit-log": mapAuditLog,
  opname: mapOpname,
  warehouses: mapWarehouses,
  products: mapProducts,
  productCategories: mapProductCategories,
  leadSources: mapLeadSourcesGroup,
  lostReasons: mapLeadSourcesGroup,
  expenseCategories: mapLeadSourcesGroup,
  costCenters: mapLeadSourcesGroup,
  dealTypes: mapLeadSourcesGroup,
  serials: mapSerials,
  movements: mapMovements,
  reservations: mapReservations,
  followups: mapFollowups,
};

export function adaptRow(module: string, raw: any): Row {
  const base: Row = {
    id: String(raw.id),
    createdAt: raw.createdAt ?? raw.date ?? raw.tanggal ?? raw.dibuat ?? null,
  };
  const mapper = ROW_MAPPERS[module];
  return mapper ? mapper(raw, base) : { ...base, ...raw };
}

export function adaptRows(module: string, list: any[] | undefined): Row[] {
  return (list ?? []).map((r) => adaptRow(module, r));
}
