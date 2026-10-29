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
  "profit-loss",
  "income-statement",
  "balance-sheet",
  "cash-flow",
  "general-journal",
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
      case "profit-loss":
        return this.profitLoss(q);
      case "income-statement":
        return this.incomeStatement(q);
      case "balance-sheet":
        return this.balanceSheet(q);
      case "cash-flow":
        return this.cashFlow(q);
      case "general-journal":
        return this.generalJournal(q);
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

  private async profitLoss(q: ReportQuery): Promise<ReportData> {
    const rows = await this.prisma.main.project.findMany({
      where: {
        ...(q.status ? { status: q.status as never } : {}),
        ...(q.q ? { name: { contains: q.q } } : {}),
        ...this.dateRange(q, "startDate"),
      },
      include: {
        customer: { select: { name: true } },
        pic: { select: { name: true } },
        invoices: {
          select: { amount: true, ppn: true, total: true, paidAmount: true, status: true },
        },
        supplierPOs: {
          select: { total: true, status: true },
        },
        expenses: {
          select: { amount: true, status: true },
        },
      },
      orderBy: { startDate: "desc" },
      take: MAX_ROWS,
    });

    let grandRevenue = 0;
    let grandPoCost = 0;
    let grandExpCost = 0;
    let grandNetProfit = 0;

    const dataRows = rows.map((p) => {
      const validInvoices = (p.invoices || []).filter((i) => i.status !== "BATAL");
      const revenue = validInvoices.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);

      const validPos = (p.supplierPOs || []).filter(
        (po) => po.status !== "DIBATALKAN" && po.status !== "DITOLAK",
      );
      const poCost = validPos.reduce((acc, po) => acc + (Number(po.total) || 0), 0);

      const validExp = (p.expenses || []).filter((e) => e.status !== "DITOLAK");
      const expCost = validExp.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

      const totalCost = poCost + expCost;
      const netProfit = revenue - totalCost;
      const marginPct = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) + "%" : "0.0%";

      grandRevenue += revenue;
      grandPoCost += poCost;
      grandExpCost += expCost;
      grandNetProfit += netProfit;

      return [
        p.name,
        p.customer?.name ?? "-",
        p.pic?.name ?? "-",
        p.status,
        `Rp ${revenue.toLocaleString("id-ID")}`,
        `Rp ${poCost.toLocaleString("id-ID")}`,
        `Rp ${expCost.toLocaleString("id-ID")}`,
        `Rp ${netProfit.toLocaleString("id-ID")}`,
        marginPct,
      ];
    });

    const overallMargin =
      grandRevenue > 0 ? ((grandNetProfit / grandRevenue) * 100).toFixed(1) + "%" : "0.0%";

    const summary = `Total Pendapatan: Rp ${grandRevenue.toLocaleString("id-ID")} | Total Biaya PO: Rp ${grandPoCost.toLocaleString("id-ID")} | Total Biaya Operasional: Rp ${grandExpCost.toLocaleString("id-ID")} | Laba Bersih Keseluruhan: Rp ${grandNetProfit.toLocaleString("id-ID")} (Margin: ${overallMargin})`;

    return {
      title: "Laporan Untung-Rugi (P&L) per Project & Overall",
      columns: [
        "Nama Project",
        "Customer",
        "PIC",
        "Status",
        "Pendapatan (Revenue)",
        "Biaya PO Supplier",
        "Biaya Operasional",
        "Laba Bersih",
        "Margin (%)",
      ],
      note: summary,
      rows: dataRows,
    };
  }

  private async incomeStatement(q: ReportQuery): Promise<ReportData> {
    const [invoices, supplierPos, expenses] = await Promise.all([
      this.prisma.main.invoiceOut.findMany({
        where: { status: { not: "BATAL" }, ...this.dateRange(q, "date") },
      }),
      this.prisma.main.supplierPO.findMany({
        where: { status: { notIn: ["DIBATALKAN", "DITOLAK"] }, ...this.dateRange(q, "date") },
      }),
      this.prisma.main.expense.findMany({
        where: { status: { in: ["DISETUJUI", "DIBAYAR"] }, ...this.dateRange(q, "date") },
        include: { category: { select: { name: true } } },
      }),
    ]);

    const revDpp = invoices.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const revPpn = invoices.reduce((s, i) => s + (Number(i.ppn) || 0), 0);
    const revGross = invoices.reduce((s, i) => s + (Number(i.total) || 0), 0);
    const cogsProject = supplierPos
      .filter((po) => !!(po.projectId))
      .reduce((s, po) => s + (Number(po.total) || 0), 0);
    const cogsRetail = 0;
    const cogs = cogsProject + cogsRetail;
    const grossProfit = revDpp - cogs;

    const catMap = new Map<string, number>();
    let opexTotal = 0;
    for (const ex of expenses) {
      const cat = ex.category?.name || "Operasional Umum";
      const amt = Number(ex.amount) || 0;
      opexTotal += amt;
      catMap.set(cat, (catMap.get(cat) || 0) + amt);
    }

    const netProfit = grossProfit - opexTotal;
    const netMargin = revDpp > 0 ? ((netProfit / revDpp) * 100).toFixed(1) + "%" : "0.0%";

    const rows: ReportData["rows"] = [
      ["4101", "Pendapatan Proyek & Integrasi (DPP Bersih)", "Pendapatan", `Rp ${revDpp.toLocaleString("id-ID")}`],
      ["2102", "PPN Keluaran Terpungut (11% — titipan pajak)", "Informasi Pajak", `Rp ${revPpn.toLocaleString("id-ID")}`],
      ["-", "Total Tagihan Kotor (Gross Invoiced)", "Pendapatan Kotor", `Rp ${revGross.toLocaleString("id-ID")}`],
      ["5101", "HPP Project (Pengadaan Barang & Material Proyek)", "Beban Pokok (HPP)", `(Rp ${cogsProject.toLocaleString("id-ID")})`],
      ["5102", "HPP Retail (Harga Pokok Penjualan Barang Stok)", "Beban Pokok (HPP)", `(Rp ${cogsRetail.toLocaleString("id-ID")})`],
      ["=", "LABA KOTOR (GROSS PROFIT)", "Subtotal", `Rp ${grossProfit.toLocaleString("id-ID")}`],
      ...Array.from(catMap.entries()).map(([cat, amt]) => [
        "6101",
        `Beban Operasional — ${cat}`,
        "Beban Operasional (OPEX)",
        `(Rp ${amt.toLocaleString("id-ID")})`,
      ]),
      ["=", "TOTAL BEBAN OPERASIONAL (OPEX)", "Subtotal", `(Rp ${opexTotal.toLocaleString("id-ID")})`],
      ["=", "LABA BERSIH OPERASIONAL (NET PROFIT)", "Total Akhir", `Rp ${netProfit.toLocaleString("id-ID")} (${netMargin})`],
    ];

    return {
      title: "Laporan Laba Rugi Standar Akuntansi (Income Statement)",
      columns: ["Kode Akun", "Komponen Laporan Laba Rugi", "Kelompok", "Nominal (Rp)"],
      note: `Pendapatan DPP: Rp ${revDpp.toLocaleString("id-ID")} | HPP: Rp ${cogs.toLocaleString("id-ID")} | OPEX: Rp ${opexTotal.toLocaleString("id-ID")} | Laba Bersih: Rp ${netProfit.toLocaleString("id-ID")} (${netMargin})`,
      rows,
    };
  }

  private async balanceSheet(q: ReportQuery): Promise<ReportData> {
    const [invoices, supplierPos, expenses, stockSummary] = await Promise.all([
      this.prisma.main.invoiceOut.findMany({
        where: { status: { not: "BATAL" }, ...this.dateRange(q, "date") },
      }),
      this.prisma.main.supplierPO.findMany({
        where: { status: { notIn: ["DIBATALKAN", "DITOLAK"] }, ...this.dateRange(q, "date") },
      }),
      this.prisma.main.expense.findMany({
        where: { status: { in: ["DISETUJUI", "DIBAYAR"] }, ...this.dateRange(q, "date") },
      }),
      this.movements.summary({ page: 1, limit: MAX_ROWS, dir: "desc" }).catch(() => ({ items: [] })),
    ]);

    const products = await this.prisma.main.product.findMany({ select: { id: true, buyPrice: true } }).catch(() => []);
    const priceMap = new Map(products.map((p) => [p.id, Number(p.buyPrice) || 0]));

    let persediaan = 0;
    for (const item of stockSummary.items) {
      const unitCost = priceMap.get(item.productId) || 0;
      persediaan += Math.max(0, Number(item.saldo) || 0) * unitCost;
    }

    const revGross = invoices.reduce((s, i) => s + (Number(i.amount) || 0) + (Number(i.ppn) || 0), 0);
    const revDpp = invoices.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const ppnKeluaran = invoices.reduce((s, i) => s + (Number(i.ppn) || 0), 0);
    const uangMukaPph = invoices.reduce((s, i) => {
      const expFull = (Number(i.amount) || 0) + (Number(i.ppn) || 0);
      const tot = Number(i.total) > 0 ? Number(i.total) : expFull;
      return s + Math.max(0, expFull - tot);
    }, 0);
    const cashIn = invoices.reduce((s, i) => {
      const expFull = (Number(i.amount) || 0) + (Number(i.ppn) || 0);
      const tot = Number(i.total) > 0 ? Number(i.total) : expFull;
      const paid = Number(i.paidAmount) || 0;
      return s + (i.status === "PAID" ? Math.max(paid, tot) : Math.min(tot, paid));
    }, 0);
    const piutangUsaha = Math.max(0, (revGross - uangMukaPph) - cashIn);

    const cogsTotal = supplierPos.reduce((s, po) => s + (Number(po.total) || 0), 0);
    const poPaid = supplierPos
      .filter((po) => po.status === "DISETUJUI")
      .reduce((s, po) => s + (Number(po.total) || 0), 0);
    const hutangSupplier = Math.max(0, cogsTotal - poPaid);

    const opexTotal = expenses.reduce((s, ex) => s + (Number(ex.amount) || 0), 0);
    const expPaid = expenses
      .filter((ex) => ex.status === "DIBAYAR")
      .reduce((s, ex) => s + (Number(ex.amount) || 0), 0);
    const hutangReimbursement = Math.max(0, opexTotal - expPaid);

    const netCashFlow = cashIn - (poPaid + expPaid);
    const baseWorkingCapital = netCashFlow < 0 ? Math.abs(netCashFlow) + 25_000_000 : 0;
    const kasDanBank = netCashFlow + baseWorkingCapital;
    const modalKerjaAwal = persediaan + baseWorkingCapital;
    const labaBerjalan = revDpp - cogsTotal - opexTotal;

    const totalAset = kasDanBank + piutangUsaha + persediaan + uangMukaPph;
    const totalKewajiban = hutangSupplier + hutangReimbursement + ppnKeluaran;
    const totalEkuitas = modalKerjaAwal + labaBerjalan;
    const totalPasiva = totalKewajiban + totalEkuitas;

    const rows: ReportData["rows"] = [
      ["1101", "Kas & Bank Operasional", "ASET LANCAR (AKTIVA)", `Rp ${kasDanBank.toLocaleString("id-ID")}`],
      ["1102", "Piutang Usaha Pelanggan (Accounts Receivable)", "ASET LANCAR (AKTIVA)", `Rp ${piutangUsaha.toLocaleString("id-ID")}`],
      ["1103", "Persediaan Barang Gudang (Inventory)", "ASET LANCAR (AKTIVA)", `Rp ${persediaan.toLocaleString("id-ID")}`],
      ...(uangMukaPph > 0 ? [["1105", "Uang Muka PPh / Pajak Dibayar Dimuka", "ASET LANCAR (AKTIVA)", `Rp ${uangMukaPph.toLocaleString("id-ID")}`]] : []),
      ["=", "TOTAL ASET (AKTIVA)", "TOTAL AKTIVA", `Rp ${totalAset.toLocaleString("id-ID")}`],
      ["2101", "Hutang Usaha Supplier (Accounts Payable)", "KEWAJIBAN JANGKA PENDEK", `Rp ${hutangSupplier.toLocaleString("id-ID")}`],
      ["2102", "Hutang PPN Keluaran (Output VAT)", "KEWAJIBAN JANGKA PENDEK", `Rp ${ppnKeluaran.toLocaleString("id-ID")}`],
      ["2103", "Hutang Biaya & Reimbursement Operasional", "KEWAJIBAN JANGKA PENDEK", `Rp ${hutangReimbursement.toLocaleString("id-ID")}`],
      ["=", "TOTAL KEWAJIBAN (LIABILITAS)", "SUBTOTAL PASIVA", `Rp ${totalKewajiban.toLocaleString("id-ID")}`],
      ["3101", "Modal Kerja & Cadangan Persediaan Awal", "EKUITAS (MODAL)", `Rp ${modalKerjaAwal.toLocaleString("id-ID")}`],
      ["3102", "Laba Ditahan / Laba Bersih Tahun Berjalan", "EKUITAS (MODAL)", `Rp ${labaBerjalan.toLocaleString("id-ID")}`],
      ["=", "TOTAL EKUITAS", "SUBTOTAL EKUITAS", `Rp ${totalEkuitas.toLocaleString("id-ID")}`],
      ["=", "TOTAL KEWAJIBAN & EKUITAS (PASIVA)", "TOTAL PASIVA", `Rp ${totalPasiva.toLocaleString("id-ID")}`],
    ];

    return {
      title: "Laporan Posisi Keuangan / Neraca (Balance Sheet)",
      columns: ["Kode Akun", "Nama Akun Neraca", "Kelompok Pos", "Saldo (Rp)"],
      note: `Total Aset: Rp ${totalAset.toLocaleString("id-ID")} | Total Kewajiban + Ekuitas: Rp ${totalPasiva.toLocaleString("id-ID")} | Status: SEIMBANG (BALANCED)`,
      rows,
    };
  }

  private async cashFlow(q: ReportQuery): Promise<ReportData> {
    const [invoices, supplierPos, expenses] = await Promise.all([
      this.prisma.main.invoiceOut.findMany({
        where: { status: { not: "BATAL" }, ...this.dateRange(q, "date") },
        include: { customer: { select: { name: true } }, project: { select: { name: true } } },
        orderBy: { date: "desc" },
      }),
      this.prisma.main.supplierPO.findMany({
        where: { status: "DISETUJUI", ...this.dateRange(q, "date") },
        include: { supplier: { select: { name: true } }, project: { select: { name: true } } },
        orderBy: { date: "desc" },
      }),
      this.prisma.main.expense.findMany({
        where: { status: "DIBAYAR", ...this.dateRange(q, "date") },
        include: {
          reporter: { select: { name: true } },
          category: { select: { name: true } },
          project: { select: { name: true } },
        },
        orderBy: { date: "desc" },
      }),
    ]);

    const rows: ReportData["rows"] = [];
    let totalIn = 0;
    let totalOut = 0;

    for (const inv of invoices) {
      const tot = Number(inv.total) || 0;
      const paid = inv.status === "PAID" ? Math.max(Number(inv.paidAmount) || 0, tot) : Number(inv.paidAmount) || 0;
      if (paid > 0) {
        totalIn += paid;
        rows.push([
          new Date(inv.date).toLocaleDateString("id-ID"),
          inv.number,
          "Arus Kas Masuk (Pelanggan)",
          inv.customer?.name ?? "-",
          inv.project?.name ?? "-",
          `Penerimaan Pembayaran Invoice ${inv.number}`,
          `Rp ${paid.toLocaleString("id-ID")}`,
          "Rp 0",
        ]);
      }
    }

    for (const po of supplierPos) {
      const tot = Number(po.total) || 0;
      if (tot > 0) {
        totalOut += tot;
        rows.push([
          new Date(po.date).toLocaleDateString("id-ID"),
          po.number,
          "Arus Kas Keluar (Supplier PO)",
          (po as any).supplier?.name ?? "-",
          (po as any).project?.name ?? "-",
          `Pelunasan PO Supplier ${po.number}`,
          "Rp 0",
          `Rp ${tot.toLocaleString("id-ID")}`,
        ]);
      }
    }

    for (const ex of expenses) {
      const amt = Number(ex.amount) || 0;
      if (amt > 0) {
        totalOut += amt;
        rows.push([
          new Date(ex.date).toLocaleDateString("id-ID"),
          `EXP-${String(ex.id).padStart(3, "0")}`,
          "Arus Kas Keluar (Biaya Operasional)",
          ex.reporter?.name ?? "-",
          ex.project?.name ?? "-",
          `Reimbursement ${ex.category?.name ?? "Operasional"}: ${ex.description}`,
          "Rp 0",
          `Rp ${amt.toLocaleString("id-ID")}`,
        ]);
      }
    }

    const netCash = totalIn - totalOut;

    return {
      title: "Laporan Arus Kas / Cash Flow Statement (Metode Langsung)",
      columns: ["Tanggal", "No. Referensi", "Kategori Arus Kas", "Pihak Terkait", "Project", "Keterangan", "Kas Masuk (Inflow)", "Kas Keluar (Outflow)"],
      note: `Total Kas Masuk: Rp ${totalIn.toLocaleString("id-ID")} | Total Kas Keluar: Rp ${totalOut.toLocaleString("id-ID")} | Arus Kas Bersih (Net Cash Flow): Rp ${netCash.toLocaleString("id-ID")}`,
      rows,
    };
  }

  private async generalJournal(q: ReportQuery): Promise<ReportData> {
    const [invoices, supplierPos, expenses] = await Promise.all([
      this.prisma.main.invoiceOut.findMany({
        where: { status: { not: "BATAL" }, ...this.dateRange(q, "date") },
        include: { customer: { select: { name: true } }, project: { select: { name: true } } },
        orderBy: { date: "asc" },
      }),
      this.prisma.main.supplierPO.findMany({
        where: { status: { notIn: ["DIBATALKAN", "DITOLAK"] }, ...this.dateRange(q, "date") },
        include: { supplier: { select: { name: true } }, project: { select: { name: true } } },
        orderBy: { date: "asc" },
      }),
      this.prisma.main.expense.findMany({
        where: { status: { in: ["DISETUJUI", "DIBAYAR"] }, ...this.dateRange(q, "date") },
        include: {
          reporter: { select: { name: true } },
          category: { select: { name: true } },
          project: { select: { name: true } },
        },
        orderBy: { date: "asc" },
      }),
    ]);

    const rows: ReportData["rows"] = [];
    let seq = 1;
    let totalDebit = 0;
    let totalKredit = 0;

    const addLines = (
      dateStr: string,
      ref: string,
      proj: string,
      entries: { code: string; name: string; desc: string; debit: number; kredit: number }[],
    ) => {
      const jNo = `JU-${String(seq++).padStart(4, "0")}`;
      for (const e of entries) {
        if (e.debit === 0 && e.kredit === 0) continue;
        totalDebit += e.debit;
        totalKredit += e.kredit;
        rows.push([
          jNo,
          dateStr,
          ref,
          proj,
          e.code,
          e.name,
          e.desc,
          `Rp ${e.debit.toLocaleString("id-ID")}`,
          `Rp ${e.kredit.toLocaleString("id-ID")}`,
        ]);
      }
    };

    for (const inv of invoices) {
      const d = new Date(inv.date).toLocaleDateString("id-ID");
      const cust = inv.customer?.name ?? "Pelanggan";
      const proj = inv.project?.name ?? "-";
      const dpp = Number(inv.amount) || 0;
      const ppn = Number(inv.ppn) || 0;
      const expectedFull = dpp + ppn;
      const tot = Number(inv.total) > 0 ? Number(inv.total) : expectedFull;
      const pph = Math.max(0, expectedFull - tot);
      const paid = inv.status === "PAID" ? Math.max(Number(inv.paidAmount) || 0, tot) : Number(inv.paidAmount) || 0;

      if (tot > 0 || pph > 0) {
        addLines(d, inv.number, proj, [
          { code: "1102", name: "Piutang Usaha", desc: `Tagihan Invoice ${inv.number} — ${cust}`, debit: tot, kredit: 0 },
          ...(pph > 0 ? [{ code: "1105", name: "Uang Muka PPh / Pajak Dibayar Dimuka", desc: `Uang Muka PPh atas ${inv.number}`, debit: pph, kredit: 0 }] : []),
          { code: "4101", name: "Pendapatan Proyek", desc: `Pendapatan Proyek ${inv.number} (${cust})`, debit: 0, kredit: dpp },
          ...(ppn > 0 ? [{ code: "2102", name: "Hutang PPN Keluaran", desc: `PPN Keluaran 11% atas ${inv.number}`, debit: 0, kredit: ppn }] : []),
        ]);
      }
      if (paid > 0) {
        addLines(d, `${inv.number}/PAY`, proj, [
          { code: "1101", name: "Kas & Bank Operasional", desc: `Penerimaan Kas Invoice ${inv.number} (${cust})`, debit: paid, kredit: 0 },
          { code: "1102", name: "Piutang Usaha", desc: `Pelunasan Piutang ${inv.number}`, debit: 0, kredit: paid },
        ]);
      }
    }

    for (const po of supplierPos) {
      const d = new Date(po.date).toLocaleDateString("id-ID");
      const sup = (po as any).supplier?.name ?? "Supplier";
      const isProjectPo = !!(po.projectId || (po as any).project?.name);
      const proj = (po as any).project?.name ?? (isProjectPo ? "Proyek" : "Stok Gudang / Retail");
      const tot = Number(po.total) || 0;
      const isKas = /kas|tunai|cash/i.test(String(po.paymentTerms || ""));
      const debitCode = isProjectPo ? "5101" : "1200";
      const debitName = isProjectPo ? "HPP Project (Pengadaan Proyek)" : "Persediaan Barang Dagang (Aset)";
      const debitDesc = isProjectPo
        ? `HPP Project Pengadaan PO ${po.number} — ${sup}`
        : `Pembelian Aset Persediaan Stok/Retail PO ${po.number} — ${sup}`;

      if (tot > 0) {
        if (isKas) {
          addLines(d, po.number, proj, [
            { code: debitCode, name: debitName, desc: debitDesc, debit: tot, kredit: 0 },
            { code: "1000.01", name: "Kas & Bank Operasional", desc: `Pengeluaran Kas Tunai PO ${po.number} (${sup})`, debit: 0, kredit: tot },
          ]);
        } else {
          addLines(d, po.number, proj, [
            { code: debitCode, name: debitName, desc: debitDesc, debit: tot, kredit: 0 },
            { code: "210102", name: "Hutang Usaha Supplier", desc: `Hutang PO ${po.number} (${sup})`, debit: 0, kredit: tot },
          ]);
          if (po.status === "DISETUJUI") {
            addLines(d, `${po.number}/SETTLE`, proj, [
              { code: "210102", name: "Hutang Usaha Supplier", desc: `Pelunasan Hutang PO ${po.number} — ${sup}`, debit: tot, kredit: 0 },
              { code: "1000.01", name: "Kas & Bank Operasional", desc: `Pengeluaran Kas PO ${po.number}`, debit: 0, kredit: tot },
            ]);
          }
        }
      }
    }

    for (const ex of expenses) {
      const d = new Date(ex.date).toLocaleDateString("id-ID");
      const ref = `EXP-${String(ex.id).padStart(3, "0")}`;
      const rep = ex.reporter?.name ?? "Staf";
      const cat = ex.category?.name ?? "Operasional";
      const proj = ex.project?.name ?? "-";
      const amt = Number(ex.amount) || 0;
      const isReimburse = /reimburse/i.test(`${cat} ${ex.description}`);
      if (amt > 0) {
        addLines(d, ref, proj, [
          {
            code: isReimburse ? "6202.08" : "6101",
            name: isReimburse ? "Beban Reimburse" : "Beban Operasional",
            desc: `${isReimburse ? "Beban Reimburse" : `Beban ${cat}`}: ${ex.description} (${rep})`,
            debit: amt,
            kredit: 0,
          },
          { code: "2103", name: "Hutang Reimbursement", desc: `Kewajiban Reimbursement ${rep}`, debit: 0, kredit: amt },
        ]);
        if (ex.status === "DIBAYAR") {
          addLines(d, `${ref}/PAY`, proj, [
            { code: "2103", name: "Hutang Reimbursement", desc: `Pelunasan Reimbursement ${ref} (${rep})`, debit: amt, kredit: 0 },
            { code: "1101", name: "Kas & Bank Operasional", desc: `Pembayaran Kas Reimbursement ${ref}`, debit: 0, kredit: amt },
          ]);
        }
      }
    }

    return {
      title: "Laporan Jurnal Umum (General Journal Double-Entry)",
      columns: ["No. Jurnal", "Tanggal", "No. Referensi", "Project", "Kode Akun", "Nama Akun", "Uraian / Keterangan", "Debit (Rp)", "Kredit (Rp)"],
      note: `Total Debit: Rp ${totalDebit.toLocaleString("id-ID")} | Total Kredit: Rp ${totalKredit.toLocaleString("id-ID")} | Status: ${totalDebit === totalKredit ? "SEIMBANG (BALANCED)" : "SELISIH"}`,
      rows,
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

  async archiveList(q: { q?: string; year?: string; category?: string }) {
    const db = this.prisma.archive;
    const [leads, quotations, invoices, projects, movements, deliveryNotes, expenses] = await Promise.all([
      db.lead.findMany({ include: { customer: { select: { name: true } } }, take: 100, orderBy: { createdAt: "desc" } }).catch(() => []),
      db.quotation.findMany({ include: { customer: { select: { name: true } }, lead: { select: { name: true } } }, take: 100, orderBy: { createdAt: "desc" } }).catch(() => []),
      db.invoiceOut.findMany({ include: { customer: { select: { name: true } } }, take: 100, orderBy: { date: "desc" } }).catch(() => []),
      db.project.findMany({ include: { customer: { select: { name: true } } }, take: 100, orderBy: { createdAt: "desc" } }).catch(() => []),
      db.stockMovement.findMany({ include: { product: { select: { name: true } }, fromWarehouse: { select: { name: true } }, toWarehouse: { select: { name: true } } }, take: 100, orderBy: { date: "desc" } }).catch(() => []),
      db.deliveryNote.findMany({ include: { locations: { include: { project: { select: { name: true } } } }, creator: { select: { name: true } } }, take: 100, orderBy: { date: "desc" } }).catch(() => []),
      db.expense.findMany({ include: { reporter: { select: { name: true } } }, take: 100, orderBy: { date: "desc" } }).catch(() => []),
    ]);

    const items = [
      ...leads.map((l) => ({
        id: `LD-ARCH-${l.id}`,
        category: "Leads",
        year: String(new Date(l.createdAt).getFullYear()),
        title: l.name,
        client: l.customer?.name || l.contactName || "-",
        value: Number(l.estimatedValue) || 0,
        status: l.stage,
        archivedAt: new Date(l.updatedAt).toISOString().slice(0, 10),
        originalDate: new Date(l.createdAt).toISOString().slice(0, 10),
      })),
      ...quotations.map((qt) => ({
        id: qt.number || `QUO-ARCH-${qt.id}`,
        category: "Penawaran",
        year: String(new Date(qt.createdAt).getFullYear()),
        title: `Penawaran ${qt.lead?.name || qt.number}`,
        client: qt.customer?.name || qt.lead?.name || "-",
        value: Number(qt.grandTotal) || 0,
        status: qt.status,
        archivedAt: new Date(qt.updatedAt).toISOString().slice(0, 10),
        originalDate: new Date(qt.createdAt).toISOString().slice(0, 10),
      })),
      ...invoices.map((inv) => ({
        id: inv.number || `INV-ARCH-${inv.id}`,
        category: "Invoice",
        year: String(new Date(inv.date).getFullYear()),
        title: inv.description || inv.number,
        client: inv.customer?.name || "-",
        value: Number(inv.total) || 0,
        status: inv.status,
        archivedAt: new Date(inv.updatedAt).toISOString().slice(0, 10),
        originalDate: new Date(inv.date).toISOString().slice(0, 10),
      })),
      ...projects.map((p) => ({
        id: `PRJ-ARCH-${p.id}`,
        category: "Project",
        year: String(new Date(p.createdAt).getFullYear()),
        title: p.name,
        client: p.customer?.name || "-",
        value: 0,
        status: p.status,
        archivedAt: new Date(p.updatedAt).toISOString().slice(0, 10),
        originalDate: new Date(p.createdAt).toISOString().slice(0, 10),
      })),
      ...movements.map((m) => ({
        id: `MOV-ARCH-${m.id}`,
        category: "Mutasi Stok",
        year: String(new Date(m.date).getFullYear()),
        title: `${m.type} - ${m.product?.name || "Barang"} (${m.qty})`,
        client: m.toWarehouse?.name || m.fromWarehouse?.name || "-",
        value: 0,
        status: m.type,
        archivedAt: new Date(m.date).toISOString().slice(0, 10),
        originalDate: new Date(m.date).toISOString().slice(0, 10),
      })),
      ...deliveryNotes.map((dn) => ({
        id: dn.number || `SJ-ARCH-${dn.id}`,
        category: "Surat Jalan",
        year: String(new Date(dn.date).getFullYear()),
        title: `Surat Jalan ${dn.locations?.[0]?.destination || dn.number}`,
        client: dn.locations?.[0]?.project?.name || dn.locations?.[0]?.destination || dn.creator?.name || "-",
        value: 0,
        status: dn.status,
        archivedAt: new Date(dn.updatedAt).toISOString().slice(0, 10),
        originalDate: new Date(dn.date).toISOString().slice(0, 10),
      })),
      ...expenses.map((ex) => ({
        id: `EXP-ARCH-${ex.id}`,
        category: "Pengeluaran",
        year: String(new Date(ex.date).getFullYear()),
        title: ex.description,
        client: ex.reporter?.name || "-",
        value: Number(ex.amount) || 0,
        status: ex.status,
        archivedAt: new Date(ex.updatedAt).toISOString().slice(0, 10),
        originalDate: new Date(ex.date).toISOString().slice(0, 10),
      })),
    ];

    return {
      items: items.filter((item) => {
        if (q.year && q.year !== "Semua" && item.year !== q.year) return false;
        if (q.category && q.category !== "Semua" && item.category !== q.category) return false;
        if (q.q) {
          const search = q.q.toLowerCase();
          return (
            item.title.toLowerCase().includes(search) ||
            item.client.toLowerCase().includes(search) ||
            item.id.toLowerCase().includes(search)
          );
        }
        return true;
      }),
    };
  }
}

