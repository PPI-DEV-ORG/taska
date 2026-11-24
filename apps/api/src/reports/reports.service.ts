import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { MovementsService } from "../stock/movements.service.js";
import { AccountingReportService } from "../accounting/accounting-report.service.js";
import { totalRow, type ReportData } from "./exporters.js";

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
  "invoices",
  "profit-loss",
  "income-statement",
  "balance-sheet",
  "cash-flow",
  "general-journal",
  "ppn-masukan",
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
    private readonly accountingReport: AccountingReportService,
  ) {}

  async build(type: string, q: ReportQuery): Promise<ReportData> {
    switch (type) {
      case "leads":
        return this.leads(q);
      case "followups":
        return this.followups(q);
      case "projects":
        return this.projects(q);
      case "invoices":
        return this.invoices(q);
      case "profit-loss":
        return this.profitLoss(q);
      case "income-statement":
        return this.incomeStatement(q);
      case "balance-sheet":
        return this.balanceSheet(q);
      case "cash-flow":
        return this.cashFlow(q);
      case "ppn-masukan":
        return this.ppnMasukan(q);
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

  private async invoices(q: ReportQuery): Promise<ReportData> {
    const rows = await this.prisma.main.invoiceOut.findMany({
      where: {
        isProforma: false,
        ...(q.status ? { status: q.status as never } : {}),
        ...(q.q ? { number: { contains: q.q } } : {}),
        ...this.dateRange(q, "date"),
      },
      include: {
        customer: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: MAX_ROWS,
    });

    let totalTagihan = 0;
    let totalTerbayar = 0;
    let totalSisa = 0;

    const dataRows: ReportData["rows"] = rows.map((inv) => {
      const total = Number(inv.total || 0);
      const paid = inv.status === "PAID" ? Math.max(Number(inv.paidAmount || 0), total) : Number(inv.paidAmount || 0);
      const sisa = inv.status === "BATAL" ? 0 : Math.max(0, total - paid);
      if (inv.status !== "BATAL") {
        totalTagihan += total;
        totalTerbayar += paid;
        totalSisa += sisa;
      }
      return [
        inv.number,
        new Date(inv.date).toLocaleDateString("id-ID"),
        inv.customer?.name || "-",
        inv.project?.name || "-",
        inv.type,
        `Rp ${Number(inv.amount || 0).toLocaleString("id-ID")}`,
        `Rp ${Number(inv.ppn || 0).toLocaleString("id-ID")}`,
        `Rp ${total.toLocaleString("id-ID")}`,
        `Rp ${paid.toLocaleString("id-ID")}`,
        `Rp ${sisa.toLocaleString("id-ID")}`,
        inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("id-ID") : "-",
        inv.status,
      ];
    });

    return {
      title: "Laporan Piutang & Faktur Keluar",
      columns: [
        "Nomor Invoice",
        "Tanggal",
        "Customer",
        "Project",
        "Jenis Termin",
        "DPP (Rp)",
        "PPN (Rp)",
        "Total Tagihan (Rp)",
        "Sudah Dibayar (Rp)",
        "Sisa Piutang (Rp)",
        "Jatuh Tempo",
        "Status",
      ],
      note: `Total Tagihan: Rp ${totalTagihan.toLocaleString("id-ID")} | Terbayar: Rp ${totalTerbayar.toLocaleString("id-ID")} | Sisa Piutang: Rp ${totalSisa.toLocaleString("id-ID")}`,
      rows: dataRows,
    };
  }

  private async profitLoss(q: ReportQuery): Promise<ReportData> {
    const inc = await this.accountingReport.getIncomeStatement({
      startDate: q.from,
      endDate: q.to,
    });
    const projectRows = (inc.projectRows || []).filter((r: any) => {
      if (q.status && r.status !== q.status) return false;
      if (q.q && !String(r.project || "").toLowerCase().includes(q.q.toLowerCase())) return false;
      return true;
    });

    let grandRevenue = 0;
    let grandCogs = 0;
    let grandOpex = 0;
    let grandNetProfit = 0;

    const dataRows: ReportData["rows"] = projectRows.map((r: any) => {
      grandRevenue += Number(r.revenueDpp || 0);
      grandCogs += Number(r.cogsPo || 0);
      grandOpex += Number(r.opexExpense || 0);
      grandNetProfit += Number(r.netProfit || 0);

      return [
        r.project,
        r.customer,
        r.pic || "-",
        `Rp ${Number(r.revenueDpp || 0).toLocaleString("id-ID")}`,
        `Rp ${Number(r.paidCashIn || 0).toLocaleString("id-ID")}`,
        `Rp ${Number(r.arOutstanding || 0).toLocaleString("id-ID")}`,
        `Rp ${Number(r.cogsPo || 0).toLocaleString("id-ID")}`,
        `Rp ${Number(r.opexExpense || 0).toLocaleString("id-ID")}`,
        `Rp ${Number(r.netProfit || 0).toLocaleString("id-ID")}`,
        `${r.marginPct}%`,
        r.statusKesehatan,
      ];
    });

    const overallMargin =
      grandRevenue > 0 ? ((grandNetProfit / grandRevenue) * 100).toFixed(1) + "%" : "0.0%";

    const summary = `Total Pendapatan DPP: Rp ${grandRevenue.toLocaleString("id-ID")} | Total HPP Barang & PO: Rp ${grandCogs.toLocaleString("id-ID")} | Total Biaya Lapangan: Rp ${grandOpex.toLocaleString("id-ID")} | Laba Bersih Proyek: Rp ${grandNetProfit.toLocaleString("id-ID")} (Margin: ${overallMargin})`;

    return {
      title: "Laporan Untung-Rugi (P&L) per Proyek",
      columns: [
        "Proyek",
        "Pelanggan",
        "PIC",
        "Pendapatan DPP (Rp)",
        "Kas Diterima (Rp)",
        "Sisa Piutang (Rp)",
        "HPP Barang & PO (Rp)",
        "Biaya Lapangan (Rp)",
        "Laba Bersih (Rp)",
        "Margin (%)",
        "Status Kesehatan",
      ],
      note: summary,
      rows: dataRows,
    };
  }

  private async incomeStatement(q: ReportQuery): Promise<ReportData> {
    const inc = await this.accountingReport.getIncomeStatement({
      startDate: q.from,
      endDate: q.to,
    });

    const revDpp = Number(inc.revenue?.total || 0);
    const revPpn = Number(inc.ppnKeluaran || 0);
    const revGross = Number(inc.revenueGross ?? revDpp + revPpn);
    const cogsTotal = Number(inc.cogs?.total || 0);
    const grossProfit = Number(inc.grossProfit ?? revDpp - cogsTotal);
    const opexTotal = Number(inc.operatingExpense?.total || 0);
    const otherRevTotal = Number(inc.otherRevenue?.total || 0);
    const otherExpTotal = Number(inc.otherExpense?.total || 0);
    const netProfit = Number(inc.netProfit ?? grossProfit - opexTotal + otherRevTotal - otherExpTotal);
    const grossMargin = revDpp > 0 ? ((grossProfit / revDpp) * 100).toFixed(1) + "%" : "0.0%";
    const netMargin = revDpp > 0 ? ((netProfit / revDpp) * 100).toFixed(1) + "%" : "0.0%";

    const revAccounts = inc.revenue?.accounts || [];
    const cogsAccounts = inc.cogs?.accounts || [];
    const opexAccounts = inc.operatingExpense?.accounts || [];
    const otherRevAccounts = inc.otherRevenue?.accounts || [];
    const otherExpAccounts = inc.otherExpense?.accounts || [];

    const rows: ReportData["rows"] = [
      ["-", "Nilai Tagihan Kotor Invoice Pelanggan (Termasuk PPN)", "Informasi Tagihan", `Rp ${revGross.toLocaleString("id-ID")}`],
      ["2100", "Dikurangi: PPN Keluaran 11% (Kewajiban Pajak DJP)", "Informasi Pajak", `(Rp ${revPpn.toLocaleString("id-ID")})`],
      ...(revAccounts.length > 0
        ? revAccounts.map((a: any) => [
            a.code,
            a.name,
            "I. Pendapatan Usaha (DPP)",
            a.amount >= 0
              ? `Rp ${Number(a.amount).toLocaleString("id-ID")}`
              : `(Rp ${Math.abs(Number(a.amount)).toLocaleString("id-ID")})`,
          ])
        : [["4000", "Pendapatan Operasional (DPP Bersih)", "I. Pendapatan Usaha (DPP)", `Rp ${revDpp.toLocaleString("id-ID")}`]]),
      totalRow("", "TOTAL PENDAPATAN BERSIH OPERASIONAL (DPP)", "Subtotal Pendapatan", `Rp ${revDpp.toLocaleString("id-ID")}`),
      ...(cogsAccounts.length > 0
        ? cogsAccounts.map((a: any) => [
            a.code,
            a.name,
            "II. Beban Pokok Penjualan (HPP)",
            `(Rp ${Number(a.amount).toLocaleString("id-ID")})`,
          ])
        : [
            ["5101", "HPP Project (Pengadaan Barang & Material Proyek)", "II. Beban Pokok Penjualan (HPP)", "Rp 0"],
            ["5102", "HPP Retail (Harga Pokok Penjualan Barang Stok)", "II. Beban Pokok Penjualan (HPP)", "Rp 0"],
          ]),
      totalRow("", "TOTAL BEBAN POKOK PENJUALAN (HPP)", "Subtotal HPP", `(Rp ${cogsTotal.toLocaleString("id-ID")})`),
      totalRow("", `LABA KOTOR (GROSS PROFIT) — Margin ${grossMargin}`, "Subtotal Laba Kotor", `Rp ${grossProfit.toLocaleString("id-ID")}`),
      ...opexAccounts.map((a: any) => [
        a.code,
        a.name,
        "III. Beban Operasional (OPEX)",
        `(Rp ${Number(a.amount).toLocaleString("id-ID")})`,
      ]),
      totalRow("", "TOTAL BEBAN OPERASIONAL (OPEX)", "Subtotal OPEX", `(Rp ${opexTotal.toLocaleString("id-ID")})`),
      ...otherRevAccounts.map((a: any) => [
        a.code,
        a.name,
        "IV. Pendapatan Diluar Usaha",
        `Rp ${Number(a.amount).toLocaleString("id-ID")}`,
      ]),
      ...otherExpAccounts.map((a: any) => [
        a.code,
        a.name,
        "IV. Beban Diluar Usaha",
        `(Rp ${Number(a.amount).toLocaleString("id-ID")})`,
      ]),
      totalRow("", `LABA BERSIH OPERASIONAL (NET PROFIT) — Margin ${netMargin}`, "Total Akhir", `Rp ${netProfit.toLocaleString("id-ID")}`),
    ];

    return {
      title: "Laporan Laba Rugi Standar Akuntansi (Income Statement)",
      columns: ["Kode Akun", "Komponen Laporan Laba Rugi", "Kelompok", "Nominal (Rp)"],
      note: `Pendapatan DPP: Rp ${revDpp.toLocaleString("id-ID")} | HPP: Rp ${cogsTotal.toLocaleString("id-ID")} | OPEX: Rp ${opexTotal.toLocaleString("id-ID")} | Laba Bersih: Rp ${netProfit.toLocaleString("id-ID")} (${netMargin})`,
      rows,
    };
  }

  /** Label periode untuk catatan laporan. */
  private periodLabel(q: ReportQuery, asOf = false): string {
    // Batas periode dikirim frontend sebagai tanggal kalender dalam UTC (YYYY-MM-DDT00:00Z / T23:59Z).
    // Format juga dalam UTC; dulu zona WIB (+7) membuat "s/d 24 Nov 23:59Z" tercetak "25 Nov".
    const fmt = (v?: string) =>
      v ? new Date(v).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }) : "";
    if (asOf) return q.to || q.from ? `Per ${fmt(q.to || q.from)}` : `Per ${fmt(new Date().toISOString())}`;
    if (q.from && q.to) return `Periode ${fmt(q.from)} s/d ${fmt(q.to)}`;
    if (q.from) return `Sejak ${fmt(q.from)}`;
    if (q.to) return `Sampai ${fmt(q.to)}`;
    return "Semua periode";
  }

  // Nominal dikirim sebagai number: exporter memformatnya (Excel tetap angka & bisa dijumlah).
  private async balanceSheet(q: ReportQuery): Promise<ReportData> {
    const bs = await this.accountingReport.getBalanceSheet({ asOfDate: q.to || q.from });
    const assetsItems = bs.assets?.items || [];
    const liabItems = bs.liabilities?.items || [];
    const eqItems = bs.equity?.items || [];

    const totalAset = Number(bs.assets?.total || 0);
    const totalKewajiban = Number(bs.liabilities?.total || 0);
    const totalEkuitas = Number(bs.equity?.total || 0);
    const totalPasiva = Number(bs.totalLiabilitiesAndEquity ?? totalKewajiban + totalEkuitas);
    const isBalanced = Boolean(bs.isBalanced);

    const ppnMasukan = assetsItems
      .filter((i: any) => i.code === "1600" || i.code === "1104" || String(i.code).startsWith("1600."))
      .reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
    const ppnKeluaran = liabItems
      .filter((i: any) => i.code === "2100" || i.code === "2102" || String(i.code).startsWith("2100."))
      .reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
    const selisihPpn = ppnKeluaran - ppnMasukan;

    const rows: ReportData["rows"] = [
      ...assetsItems.map((it: any) => [it.code, it.name, `AKTIVA — ${(it.category || "ASET LANCAR").toUpperCase()}`, Number(it.amount || 0)]),
      totalRow("", "TOTAL AKTIVA (ASET PERUSAHAAN)", "TOTAL AKTIVA", totalAset),
      ...liabItems.map((it: any) => [
        it.code,
        it.name,
        `PASIVA — ${(it.category || "KEWAJIBAN JANGKA PENDEK").toUpperCase()}`,
        Number(it.amount || 0),
      ]),
      totalRow("", "SUBTOTAL KEWAJIBAN (LIABILITIES)", "SUBTOTAL KEWAJIBAN", totalKewajiban),
      ...eqItems.map((it: any) => [it.code, it.name, "PASIVA — EKUITAS (MODAL & LABA DITAHAN)", Number(it.amount || 0)]),
      totalRow("", "SUBTOTAL EKUITAS (MODAL)", "SUBTOTAL EKUITAS", totalEkuitas),
      totalRow("", "TOTAL PASIVA (KEWAJIBAN + EKUITAS)", "TOTAL PASIVA", totalPasiva),
      [
        "PAJAK",
        selisihPpn > 0
          ? "Posisi PPN DJP: PPN Kurang Bayar (Setor Kas Negara)"
          : selisihPpn < 0
          ? "Posisi PPN DJP: PPN Lebih Bayar (Kompensasi)"
          : "Posisi PPN DJP: PPN Nihil",
        `PPN Keluaran Rp ${ppnKeluaran.toLocaleString("id-ID")} vs PPN Masukan Rp ${ppnMasukan.toLocaleString("id-ID")}`,
        Math.abs(selisihPpn),
      ],
    ];

    return {
      title: "Laporan Posisi Keuangan - Neraca (Balance Sheet)",
      columns: ["Kode Akun", "Nama Akun Neraca", "Kelompok Pos", "Saldo (Rp)"],
      note: `${this.periodLabel(q, true)} | Total Aktiva: Rp ${totalAset.toLocaleString("id-ID")} | Total Pasiva: Rp ${totalPasiva.toLocaleString("id-ID")} | Status: ${isBalanced ? "SEIMBANG (BALANCED)" : `SELISIH Rp ${Math.abs(totalAset - totalPasiva).toLocaleString("id-ID")}`}`,
      rows,
      wrapCols: [1],
    };
  }

  private async cashFlow(q: ReportQuery): Promise<ReportData> {
    const cf = await this.accountingReport.getCashFlow({
      startDate: q.from,
      endDate: q.to,
    });

    const totalIn = Number(cf.totalInflow || 0);
    const totalOut = Number(cf.totalOutflow || 0);
    const netCash = Number(cf.netCashFlow || 0);

    const rows: ReportData["rows"] = [
      ...(cf.items || []).map((item: any) => [
        item.tanggal,
        item.refNo,
        item.kategori,
        item.pihak,
        item.project || "-",
        item.keterangan,
        Number(item.masuk || 0),
        Number(item.keluar || 0),
      ]),
      ["TOTAL", "", "TOTAL ARUS KAS", "", "", `Arus kas bersih (net): Rp ${netCash.toLocaleString("id-ID")}`, totalIn, totalOut],
    ];

    return {
      title: "Laporan Arus Kas - Cash Flow (Metode Langsung)",
      columns: ["Tanggal", "No. Referensi", "Kategori Arus Kas", "Pihak Terkait", "Project", "Keterangan", "Kas Masuk (Rp)", "Kas Keluar (Rp)"],
      note: `${this.periodLabel(q)} | Total Kas Masuk: Rp ${totalIn.toLocaleString("id-ID")} | Total Kas Keluar: Rp ${totalOut.toLocaleString("id-ID")} | Arus Kas Bersih: Rp ${netCash.toLocaleString("id-ID")}`,
      rows,
      wrapCols: [5],
    };
  }

  private async generalJournal(q: ReportQuery): Promise<ReportData> {
    const lines = await this.accountingReport.getGeneralLedger({
      startDate: q.from,
      endDate: q.to,
    });

    const rows: ReportData["rows"] = [];
    let totalDebit = 0;
    let totalKredit = 0;

    for (const l of lines) {
      const d = Number(l.debit || 0);
      const c = Number(l.credit || 0);
      totalDebit += d;
      totalKredit += c;
      rows.push([
        l.entryNumber,
        new Date(l.date).toLocaleDateString("id-ID"),
        l.refNo || "-",
        l.projectId ? `Project #${l.projectId}` : "-",
        l.accountCode,
        l.accountName || "-",
        l.memo || "-",
        d,
        c,
      ]);
    }

    const balanced = Math.abs(totalDebit - totalKredit) < 0.5;
    rows.push(["TOTAL", "", "", "", "", "", balanced ? "SEIMBANG (BALANCED)" : "SELISIH", totalDebit, totalKredit]);

    return {
      title: "Laporan Jurnal Umum (General Journal)",
      columns: ["No. Jurnal", "Tanggal", "No. Referensi", "Project", "Kode Akun", "Nama Akun", "Uraian / Keterangan", "Debit (Rp)", "Kredit (Rp)"],
      note: `${this.periodLabel(q)} | Total Debit: Rp ${totalDebit.toLocaleString("id-ID")} | Total Kredit: Rp ${totalKredit.toLocaleString("id-ID")} | Status: ${balanced ? "SEIMBANG (BALANCED)" : "SELISIH"}`,
      rows,
      wrapCols: [6],
    };
  }
  /**
   * Rekap PPN Masukan dari tagihan supplier (Invoice In) ber-PPN, untuk dicocokkan dengan daftar faktur masukan
   * yang otomatis muncul di Coretax (faktur masukan tidak lagi diimpor pembeli). Kolom "Perlu dicek" menandai data
   * yang belum lengkap: nomor faktur pajak kosong, NPWP supplier belum tercatat, supplier Non-PKP tapi ber-PPN.
   */
  private async ppnMasukan(q: ReportQuery): Promise<ReportData> {
    const range = this.dateRange(q, "date");
    const createdRange = this.dateRange(q, "createdAt");
    const bills = await this.prisma.main.invoiceIn.findMany({
      where: {
        status: { not: "BATAL" },
        ppn: { gt: 0 },
        ...(q.from || q.to ? { OR: [range, { date: null, ...createdRange }] } : {}),
      },
      include: {
        supplier: { select: { name: true, taxStatus: true, notes: true } },
        supplierPo: { select: { number: true } },
      },
      orderBy: [{ date: "asc" }, { id: "asc" }],
      take: MAX_ROWS,
    });

    const STATUS: Record<string, string> = { UNPAID: "Belum dibayar", PARTIAL: "Dibayar sebagian", PAID: "Lunas", OVERDUE: "Jatuh tempo" };
    const npwpOf = (notes?: string | null) => {
      const m = String(notes ?? "").match(/npwp\s*[:=]?\s*([0-9.\-]{15,22})/i);
      const digits = m?.[1]?.replace(/\D/g, "") ?? "";
      return digits.length >= 15 ? digits : "";
    };

    let totalDpp = 0;
    let totalPpn = 0;
    let needCheck = 0;
    const rows: ReportData["rows"] = bills.map((b) => {
      const ppn = Number(b.ppn || 0);
      const total = Number(b.total || 0);
      const dpp = Number(b.amount || 0) || Math.max(0, total - ppn);
      totalDpp += dpp;
      totalPpn += ppn;
      const npwp = npwpOf(b.supplier?.notes);
      const issues = [
        !b.taxInvoiceNumber ? "No. faktur pajak kosong" : "",
        !npwp ? "NPWP supplier belum tercatat" : "",
        String(b.supplier?.taxStatus ?? "NON_PKP").toUpperCase() !== "PKP" ? "Supplier tercatat Non-PKP" : "",
      ].filter(Boolean);
      if (issues.length) needCheck++;
      const d = b.date ?? b.createdAt;
      return [
        d ? new Date(d).toLocaleDateString("id-ID") : "-",
        b.number || `#${b.id}`,
        b.supplierPo?.number || "-",
        b.supplier?.name || "-",
        npwp || "-",
        b.taxInvoiceNumber || "-",
        dpp,
        ppn,
        STATUS[b.status] ?? b.status,
        issues.length ? issues.join("; ") : "OK",
      ];
    });
    rows.push(totalRow("TOTAL", "", "", `${bills.length} tagihan`, "", "", totalDpp, totalPpn, "", needCheck ? `${needCheck} perlu dicek` : "Semua OK"));

    return {
      title: "Rekap PPN Masukan (Pencocokan Coretax)",
      columns: ["Tanggal", "No. Tagihan", "No. PO", "Supplier", "NPWP Supplier", "No. Faktur Pajak", "DPP (Rp)", "PPN (Rp)", "Status Bayar", "Perlu Dicek"],
      note: [
        this.periodLabel(q),
        `${bills.length} tagihan ber-PPN`,
        `Total DPP: Rp ${totalDpp.toLocaleString("id-ID")}`,
        `Total PPN Masukan: Rp ${totalPpn.toLocaleString("id-ID")}`,
        needCheck ? `${needCheck} tagihan perlu dilengkapi sebelum dicocokkan dengan Coretax` : "Semua tagihan lengkap",
        "Cocokkan dengan menu Faktur Masukan di Coretax; faktur masukan dibuat oleh supplier, tidak diimpor",
      ].join(" | "),
      rows,
      wrapCols: [9],
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

