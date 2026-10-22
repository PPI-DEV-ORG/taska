import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";

type Tile = { key: string; label: string; value: number };

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvals: ApprovalsService,
  ) {}

  private today(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  async summary(user: RequestUser): Promise<Record<string, unknown>> {
    const today = this.today();
    const role = user.role;

    if (role === "SALES") {
      const [stages, followUpsDue, surveys] = await Promise.all([
        this.prisma.main.lead.groupBy({ by: ["stage"], _count: true }),
        this.prisma.main.followUp.findMany({
          where: { status: "TERJADWAL", nextDate: { lte: today }, createdById: user.id },
          include: { lead: { select: { name: true } } },
          orderBy: { nextDate: "asc" },
          take: 10,
        }),
        this.prisma.main.survey.count({
          where: { requestedById: user.id, status: { in: ["DIMINTA", "DIJADWALKAN"] } },
        }),
      ]);
      return {
        role,
        tiles: [
          ...stages.map((s) => ({ key: s.stage, label: `Lead ${s.stage}`, value: s._count })),
          { key: "followupDue", label: "Follow-up jatuh tempo", value: followUpsDue.length },
          { key: "surveys", label: "Survey menunggu", value: surveys },
        ],
        followUpsDue,
      };
    }

    if (role === "TEKNISI" || role === "SE") {
      const [tasks, surveyMembers, deliveries] = await Promise.all([
        this.prisma.main.task.findMany({
          where: { assigneeId: user.id, status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] } },
          include: { project: { select: { name: true } } },
          orderBy: { dueDate: "asc" },
          take: 10,
        }),
        this.prisma.main.surveyMember.findMany({
          where: { userId: user.id },
          include: { survey: { select: { location: true, scheduleAt: true, status: true } } },
          take: 10,
        }),
        this.prisma.main.deliveryNote.count({
          where: { creatorId: user.id, status: "PENDING" },
        }),
      ]);
      return {
        role,
        tiles: [
          { key: "tasks", label: "Tugas aktif", value: tasks.length },
          { key: "surveys", label: "Penugasan survey", value: surveyMembers.length },
          { key: "deliveryPending", label: "Surat jalan pending", value: deliveries },
        ],
        tasks,
        surveyAssignments: surveyMembers,
      };
    }

    if (role === "PM") {
      const mine = { picId: user.id, status: { in: ["BERJALAN", "DITUNDA", "TERLAMBAT"] as never } };
      const [projects, paymentDue, requests, overdueTasks] = await Promise.all([
        this.prisma.main.project.count({ where: mine }),
        this.prisma.main.project.count({
          where: { picId: user.id, paymentStatus: "BELUM_LUNAS", status: { not: "SELESAI" } },
        }),
        this.prisma.main.purchaseRequest.count({
          where: { status: { in: ["DIAJUKAN", "CEK_STOK", "DISETUJUI"] } },
        }),
        this.prisma.main.task.count({
          where: {
            project: { picId: user.id },
            status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] },
            dueDate: { lt: today },
          },
        }),
      ]);
      return {
        role,
        tiles: [
          { key: "projects", label: "Project berjalan", value: projects },
          { key: "paymentDue", label: "Belum lunas", value: paymentDue },
          { key: "requests", label: "Request menunggu", value: requests },
          { key: "overdueTasks", label: "Task terlambat", value: overdueTasks },
        ],
      };
    }

    if (role === "PROCUREMENT") {
      const [requests, poPending, poShipments, approvals] = await Promise.all([
        this.prisma.main.purchaseRequest.groupBy({
          by: ["status"],
          _count: true,
          where: { status: { in: ["DIAJUKAN", "CEK_STOK", "DISETUJUI", "PO_DIBUAT", "DIKIRIM"] } },
        }),
        this.prisma.main.supplierPO.count({
          where: { status: "MENUNGGU_PERSETUJUAN" },
        }),
        this.prisma.main.supplierPO.groupBy({
          by: ["shipmentStatus"],
          _count: true,
          where: { status: "DISETUJUI" },
        }),
        this.approvals.pendingFor(user),
      ]);
      return {
        role,
        tiles: [
          ...requests.map((r) => ({ key: r.status, label: `Request ${r.status}`, value: r._count })),
          { key: "poPending", label: "PO menunggu approval", value: poPending },
          { key: "approvals", label: "Antrean persetujuan", value: approvals.total },
        ],
        poShipments,
        approvals: approvals.items,
      };
    }

    if (role === "FINANCE") {
      const [invoicesDue, expenses, approvals] = await Promise.all([
        this.prisma.main.invoiceOut.findMany({
          where: { dueDate: { lte: today }, status: { notIn: ["PAID", "BATAL"] } },
          include: { customer: { select: { name: true } } },
          orderBy: { dueDate: "asc" },
          take: 10,
        }),
        this.prisma.main.expense.count({ where: { status: "DILAPORKAN" } }),
        this.approvals.pendingFor(user),
      ]);
      return {
        role,
        tiles: [
          { key: "invoicesDue", label: "Invoice jatuh tempo", value: invoicesDue.length },
          { key: "expenses", label: "Pengeluaran menunggu", value: expenses },
          { key: "approvals", label: "Antrean persetujuan", value: approvals.total },
        ],
        invoicesDue,
        approvals: approvals.items,
      };
    }

    if (role === "GUDANG") {
      const [balances, deliveryPending, opnamePending, issues] = await Promise.all([
        this.prisma.main.stockBalance.findMany({
          include: { product: { select: { minStock: true, name: true, sku: true } } },
        }),
        this.prisma.main.deliveryNote.count({ where: { status: "PENDING" } }),
        this.prisma.main.stockOpname.count({
          where: { status: "MENUNGGU_PERSETUJUAN" },
        }),
        this.prisma.main.issueReport.count({ where: { status: "DILAPORKAN" } }),
      ]);
      const productMap = new Map<number, { minStock: number | null; name: string; sku: string }>();
      const totals = new Map<number, number>();
      for (const b of balances) {
        totals.set(b.productId, (totals.get(b.productId) ?? 0) + b.qty);
        if (!productMap.has(b.productId) && b.product) {
          productMap.set(b.productId, b.product);
        }
      }
      const lowStock: Array<{ productId: number; sku?: string; name?: string; qty: number; minStock?: number | null }> = [];
      for (const [id, qty] of totals.entries()) {
        const prod = productMap.get(id);
        const min = prod?.minStock ?? 0;
        if (min > 0 && qty < min) {
          lowStock.push({
            productId: id,
            sku: prod?.sku,
            name: prod?.name,
            qty,
            minStock: prod?.minStock,
          });
        }
      }
      return {
        role,
        tiles: [
          { key: "lowStock", label: "Stok di bawah minimum", value: lowStock.length },
          { key: "deliveryPending", label: "Surat jalan pending", value: deliveryPending },
          { key: "opnamePending", label: "Opname menunggu", value: opnamePending },
          { key: "issues", label: "Barang bermasalah", value: issues },
        ],
        lowStock: lowStock.slice(0, 20),
      };
    }

    // BOS / ADMIN / ringkas
    const approvals = await this.approvals.pendingFor(user);
    const [projects, leads, invoices, expenses, requests, deliveries] = await Promise.all([
      this.prisma.main.project.count({ where: { status: { in: ["BERJALAN", "DITUNDA", "TERLAMBAT"] as never } } }),
      this.prisma.main.lead.count({ where: { stage: { notIn: ["WON", "LOST"] } } }),
      this.prisma.main.invoiceOut.count({ where: { dueDate: { lte: today }, status: { notIn: ["PAID", "BATAL"] } } }),
      this.prisma.main.expense.count({ where: { status: "DILAPORKAN" } }),
      this.prisma.main.purchaseRequest.count({ where: { status: { in: ["DIAJUKAN", "CEK_STOK"] } } }),
      this.prisma.main.deliveryNote.count({ where: { status: "PENDING" } }),
    ]);
    return {
      role,
      tiles: [
        { key: "projects", label: "Project berjalan", value: projects },
        { key: "leads", label: "Lead terbuka", value: leads },
        { key: "invoicesDue", label: "Invoice jatuh tempo", value: invoices },
        { key: "approvals", label: "Antrean persetujuan", value: approvals.total },
        { key: "expenses", label: "Pengeluaran menunggu", value: expenses },
        { key: "requests", label: "Request menunggu", value: requests },
        { key: "deliveryPending", label: "Surat jalan pending", value: deliveries },
      ],
      approvals: approvals.items,
    } satisfies { role: string; tiles: Tile[]; approvals?: unknown };
  }
}
