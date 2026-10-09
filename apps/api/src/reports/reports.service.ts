import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { MovementsService } from "../stock/movements.service.js";
import type { ReportData } from "./exporters.js";

export type ReportQuery = {
  page?: string;
  limit?: string;
  q?: string;
  from?: string;
  to?: string;
  status?: string;
  stage?: string;
  warehouseId?: string;
  due?: string;
};

export const REPORT_TYPES = [
  "leads",
  "followups",
  "projects",
  "delivery-notes",
  "stock",
  "expenses",
  "approvals",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

const MAX_ROWS = 5000;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvals: ApprovalsService,
    private readonly movements: MovementsService,
  ) {}

  async build(type: string, q: ReportQuery): Promise<ReportData> {
    switch (type) {
      case "leads":
        return this.leads(q);
      case "followups":
        return this.followups(q);
      case "projects":
        return this.projects(q);
      case "delivery-notes":
        return this.deliveryNotes(q);
      case "stock":
        return this.stock(q);
      case "expenses":
        return this.expenses(q);
      case "approvals":
        return this.approvalsReport(q);
      default:
        throw new BadRequestException(
          `Laporan tidak dikenal. Pilihan: ${REPORT_TYPES.join(", ")}`,
        );
    }
  }

  private dateRange(q: ReportQuery, field = "createdAt") {
    if (!q.from && !q.to) return {};
    return {
      [field]: {
        ...(q.from ? { gte: new Date(q.from) } : {}),
        ...(q.to ? { lte: new Date(q.to) } : {}),
      },
    };
  }

  private async leads(q: ReportQuery): Promise<ReportData> {
    const rows = await this.prisma.main.lead.findMany({
      where: {
        ...(q.stage ? { stage: q.stage as never } : {}),
        ...(q.q ? { name: { contains: q.q } } : {}),
        ...this.dateRange(q),
      },
      include: { owner: { select: { name: true } }, lostReason: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
    });
    const stageCount = await this.prisma.main.lead.groupBy({ by: ["stage"], _count: true });
    const summary = stageCount.map((s) => `${s.stage}: ${s._count}`).join(" | ");
    return {
      title: "Laporan Lead per Stage",
      columns: ["Nama", "Stage", "Pemilik", "Nilai Estimasi", "Target Closing", "Alasan Lost", "Dibuat"],
      note: summary,
      rows: rows.map((r) => [
        r.name,
        r.stage,
        r.owner.name,
        r.estimatedValue ? Number(r.estimatedValue) : null,
        r.targetClosing ? new Date(r.targetClosing).toLocaleDateString("id-ID") : "",
        r.lostReason?.name ?? "",
        new Date(r.createdAt).toLocaleDateString("id-ID"),
      ]),
    };
  }

  private async followups(q: ReportQuery): Promise<ReportData> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400000);
    const where = {
      ...(q.due === "overdue" ? { nextDate: { lt: today }, status: "TERJADWAL" as const } : {}),
      ...(q.due === "today" ? { nextDate: { gte: today, lt: tomorrow } } : {}),
      ...(q.q ? { notes: { contains: q.q } } : {}),
      ...this.dateRange(q),
    };
    const rows = await this.prisma.main.followUp.findMany({
      where,
      include: {
        lead: { select: { name: true } },
        creator: { select: { name: true } },
      },
      orderBy: { nextDate: "asc" },
      take: MAX_ROWS,
    });
    const dueCount = await this.prisma.main.followUp.count({
      where: { status: "TERJADWAL", nextDate: { lt: tomorrow } },
    });
    return {
      title: "Laporan Follow-up",
      columns: ["Tanggal", "Jatuh Tempo", "Metode", "Lead", "Catatan", "Status", "Pembuat"],
      note: `Follow-up terjadwal belum selesai (≤ hari ini): ${dueCount}`,
      rows: rows.map((r) => [
        new Date(r.date).toLocaleDateString("id-ID"),
        r.nextDate ? new Date(r.nextDate).toLocaleDateString("id-ID") : "",
        r.method,
        r.lead?.name ?? "",
        r.notes,
        r.status,
        r.creator?.name ?? "",
      ]),
    };
  }

  private async projects(q: ReportQuery): Promise<ReportData> {
    const rows = await this.prisma.main.project.findMany({
      where: {
        ...(q.status ? { status: q.status as never } : {}),
        ...(q.q ? { name: { contains: q.q } } : {}),
        ...this.dateRange(q),
      },
      include: {
        pic: { select: { name: true } },
        customer: { select: { name: true } },
        quotation: { select: { number: true, total: true } },
      },
      orderBy: { startDate: "desc" },
      take: MAX_ROWS,
    });
    const counts = await this.prisma.main.project.groupBy({ by: ["status"], _count: true });
    return {
      title: "Laporan Project",
      columns: ["Nama", "Customer", "PIC", "Status", "Pembayaran", "Mulai", "Selesai", "Nilai"],
      note: counts.map((c) => `${c.status}: ${c._count}`).join(" | "),
      rows: rows.map((r) => [
        r.name,
        r.customer?.name ?? "",
        r.pic.name,
        r.status,
        r.paymentStatus,
        new Date(r.startDate).toLocaleDateString("id-ID"),
        r.endDate ? new Date(r.endDate).toLocaleDateString("id-ID") : "",
        r.quotation ? `${r.quotation.number} — Rp${Number(r.quotation.total).toLocaleString("id-ID")}` : "",
      ]),
    };
  }

  private async deliveryNotes(q: ReportQuery): Promise<ReportData> {
    const rows = await this.prisma.main.deliveryNote.findMany({
      where: {
        ...(q.status ? { status: q.status as never } : {}),
        ...(q.q ? { number: { contains: q.q } } : {}),
        ...this.dateRange(q, "date"),
      },
      include: {
        creator: { select: { name: true } },
        locations: { orderBy: { id: "asc" } },
      },
      orderBy: { date: "desc" },
      take: MAX_ROWS,
    });
    const counts = await this.prisma.main.deliveryNote.groupBy({ by: ["status"], _count: true });
    const items: ReportData["rows"] = [];
    for (const r of rows) {
      const approval = await this.approvals.getFor("SURAT_JALAN", r.id);
      items.push([
        r.number,
        new Date(r.date).toLocaleDateString("id-ID"),
        r.creator.name,
        r.withGoods ? "Ya" : "Tidak",
        r.status,
        approval?.status ?? "-",
        r.locations.map((l) => l.destination).join("; "),
        "",
      ]);
    }
    return {
      title: "Laporan Surat Jalan Terbit",
      columns: ["Nomor", "Tanggal", "Pembuat", "Bawa Barang", "Status", "Persetujuan", "Tujuan", "Penerima"],
      note: counts.map((c) => `${c.status}: ${c._count}`).join(" | "),
      rows: items,
    };
  }

  private async stock(q: ReportQuery): Promise<ReportData> {
    const summary = await this.movements.summary({
      page: 1,
      limit: MAX_ROWS,
      dir: "desc",
      ...(q.warehouseId ? { warehouseId: Number(q.warehouseId) } : {}),
      ...(q.q ? { q: q.q } : {}),
    });
    const low = summary.items.filter((r) => r.lowStock).length;
    const warehouses = await this.prisma.main.warehouse.findMany({ select: { id: true, name: true } });
    const whName = new Map(warehouses.map((w) => [w.id, w.name]));
    return {
      title: "Laporan Stok per SKU per Gudang",
      columns: [
        "SKU",
        "Produk",
        "Gudang",
        "Masuk",
        "Keluar",
        "Transfer Masuk",
        "Transfer Keluar",
        "Saldo",
        "Min. Stok",
        "Stok Menipis",
      ],
      note: `Produk di bawah stok minimum: ${low}`,
      rows: summary.items.map((r) => [
        r.sku,
        r.name,
        whName.get(r.warehouseId) ?? r.warehouseId,
        r.masuk,
        r.keluar,
        r.transferMasuk,
        r.transferKeluar,
        r.saldo,
        r.minStock,
        r.lowStock ? "YA" : "",
      ]),
    };
  }

  private async expenses(q: ReportQuery): Promise<ReportData> {
    const rows = await this.prisma.main.expense.findMany({
      where: {
        ...(q.status ? { status: q.status as never } : {}),
        ...(q.q ? { description: { contains: q.q } } : {}),
        ...this.dateRange(q, "date"),
      },
      include: {
        reporter: { select: { name: true } },
        category: { select: { name: true } },
        project: { select: { name: true } },
        costCenter: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: MAX_ROWS,
    });
    const counts = await this.prisma.main.expense.groupBy({ by: ["status"], _count: true });
    const total = rows.reduce((s, r) => s + Number(r.amount), 0);
    return {
      title: "Laporan Pengeluaran",
      columns: ["Tanggal", "Pelapor", "Kategori", "Deskripsi", "Jumlah", "Status", "Project", "Cost Center"],
      note: `${counts.map((c) => `${c.status}: ${c._count}`).join(" | ")} | Total terpilih: Rp${total.toLocaleString("id-ID")}`,
      rows: rows.map((r) => [
        new Date(r.date).toLocaleDateString("id-ID"),
        r.reporter.name,
        r.category?.name ?? "",
        r.description,
        Number(r.amount),
        r.status,
        r.project?.name ?? "",
        r.costCenter?.name ?? "",
      ]),
    };
  }

  private async approvalsReport(q: ReportQuery): Promise<ReportData> {
    const rows = await this.prisma.main.approval.findMany({
      where: {
        ...(q.status ? { status: q.status as never } : {}),
        ...(q.q ? { title: { contains: q.q } } : {}),
        ...this.dateRange(q),
      },
      include: {
        requested_by: { select: { name: true, role: true } },
        steps: true,
      },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
    });
    return {
      title: "Laporan Dokumen Menunggu Persetujuan",
      columns: ["Judul", "Jenis", "Nilai", "Status", "Pengaju", "Tgl Pengajuan", "Menunggu Peran"],
      note: `Total: ${rows.length}`,
      rows: rows.map((r) => [
        r.title,
        r.kind,
        Number(r.amount),
        r.status,
        `${r.requested_by.name} (${r.requested_by.role})`,
        new Date(r.createdAt).toLocaleDateString("id-ID"),
        r.steps
          .filter((s) => s.status === "MENUNGGU")
          .map((s) => s.approverRole)
          .join(", "),
      ]),
    };
  }
}
