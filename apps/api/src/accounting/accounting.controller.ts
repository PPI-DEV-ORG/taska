import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { AccountsService } from "./accounts.service.js";
import { PostingService } from "./posting.service.js";
import { MappingService } from "./mapping.service.js";
import { PeriodService } from "./period.service.js";
import { AccountingReportService } from "./accounting-report.service.js";
import { TaxService } from "./tax.service.js";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Controller("accounting")
export class AccountingController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly postingService: PostingService,
    private readonly mappingService: MappingService,
    private readonly periodService: PeriodService,
    private readonly reportService: AccountingReportService,
    private readonly taxService: TaxService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("accounts")
  async listAccounts(
    @Query("cash") isCash?: string,
    @Query("postable") isPostable?: string,
    @Query("category") category?: string,
    @Query("search") search?: string,
  ) {
    return this.accountsService.list({
      isCash: isCash !== undefined ? isCash === "true" : undefined,
      isPostable: isPostable !== undefined ? isPostable === "true" : undefined,
      category,
      search,
    });
  }

  @Post("accounts")
  async createAccount(@Body() dto: any) {
    return this.accountsService.create(dto);
  }

  @Put("accounts/:code")
  async updateAccount(@Param("code") code: string, @Body() dto: any) {
    return this.accountsService.update(code, dto);
  }

  @Get("mappings")
  async getMappings() {
    return this.mappingService.getAll();
  }

  @Post("mappings")
  async setMapping(@Body() body: { key: string; accountCode: string }) {
    await this.mappingService.set(body.key, body.accountCode);
    return { success: true, key: body.key, accountCode: body.accountCode };
  }

  @Get("journals")
  async listJournals(
    @Query("page") page = "1",
    @Query("limit") limit = "50",
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("status") status?: string,
  ) {
    // Sinkronisasi otomatis untuk invoice atau surat jalan terbit/terkirim yang belum tercatat jurnal
    await this.postingService.syncUnpostedDocuments().catch(() => {});

    const p = Math.max(1, parseInt(page, 10));
    const l = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const where: any = {};
    if (status) where.status = status;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const [total, items] = await Promise.all([
      (this.prisma.main as any).journalEntry.count({ where }),
      (this.prisma.main as any).journalEntry.findMany({
        where,
        include: { lines: true },
        orderBy: { id: "desc" },
        skip: (p - 1) * l,
        take: l,
      }),
    ]);

    const expenseIds = Array.from(
      new Set(
        items
          .filter((it: any) => it.sourceType === "Expense" && it.sourceId)
          .map((it: any) => it.sourceId)
      )
    ) as number[];

    if (expenseIds.length > 0) {
      const expenses = await this.prisma.main.expense.findMany({
        where: { id: { in: expenseIds } },
        include: {
          reporter: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
        },
      });
      const expMap = new Map(expenses.map((e) => [e.id, e]));

      items.forEach((entry: any) => {
        if (entry.sourceType === "Expense" && entry.sourceId) {
          const exp = expMap.get(entry.sourceId);
          const expCode = `EXP-${String(entry.sourceId).padStart(3, "0")}`;
          const isPay = entry.event === "paid" || entry.source === "EXPENSE_PAYMENT";

          if (!entry.refNo || /^\d+$/.test(entry.refNo)) {
            entry.refNo = isPay ? `${expCode}/PAY` : expCode;
          }

          if (exp) {
            const pelapor = exp.reporter?.name || "Karyawan";
            const kategori = exp.category?.name || "Operasional";
            const deskripsi = exp.description ? `: ${exp.description}` : "";

            if (isPay) {
              entry.memo = `Pelunasan Biaya/Reimbursement ${expCode} kepada ${pelapor}`;
              (entry.lines || []).forEach((line: any) => {
                if (line.accountCode === "2103") {
                  line.memo = `Pelunasan Biaya/Reimbursement ${expCode} kepada ${pelapor}`;
                } else {
                  line.memo = `Pengeluaran Kas/Bank ${kategori} (${pelapor})${exp.description ? ` (${exp.description})` : ""}`;
                }
              });
            } else {
              entry.memo = `Beban ${kategori}${deskripsi} (${pelapor})`;
              (entry.lines || []).forEach((line: any) => {
                if (line.accountCode === "2103") {
                  line.memo = `Kewajiban Biaya/Reimbursement ${kategori} — ${pelapor}`;
                } else {
                  line.memo = `Beban ${kategori}${deskripsi} (${pelapor})`;
                }
              });
            }
          }
        }
      });
    }

    return { total, page: p, limit: l, items };
  }

  @Post("journals/manual")
  async createManualJournal(@Body() body: any, @CurrentUser() user: any) {
    return this.postingService.post({
      date: body.date || new Date(),
      source: "MANUAL",
      sourceType: "MANUAL",
      memo: body.memo,
      refNo: body.refNo,
      projectId: body.projectId,
      createdById: user?.id,
      lines: body.lines,
    });
  }

  @Post("journals/:id/reverse")
  async reverseJournal(
    @Param("id") id: string,
    @Body("reason") reason: string,
    @CurrentUser() user: any,
  ) {
    if (!reason) throw new BadRequestException("Alasan reversal wajib diisi.");
    return this.postingService.reverse(parseInt(id, 10), reason, undefined, undefined, user?.id);
  }

  @Post("sync-unposted")
  async syncUnposted(@CurrentUser() user: any) {
    return this.postingService.syncUnpostedDocuments(user?.id);
  }

  @Get("periods")
  async listPeriods(@Query("year") year?: string) {
    return this.periodService.listPeriods(year ? parseInt(year, 10) : undefined);
  }

  @Get("fiscal-years")
  async listFiscalYears() {
    return this.periodService.listFiscalYears();
  }

  @Post("periods/:year/:month/request-close")
  async requestClose(
    @Param("year") year: string,
    @Param("month") month: string,
    @CurrentUser() user: any,
  ) {
    return this.periodService.requestClose(parseInt(year, 10), parseInt(month, 10), user?.id);
  }

  @Post("periods/:year/:month/approve-close")
  async approveClose(
    @Param("year") year: string,
    @Param("month") month: string,
    @CurrentUser() user: any,
  ) {
    return this.periodService.approveClose(parseInt(year, 10), parseInt(month, 10), user);
  }

  @Post("periods/:year/:month/reopen")
  async reopenPeriod(
    @Param("year") year: string,
    @Param("month") month: string,
    @Body("reopenReason") reopenReason: string,
    @CurrentUser() user: any,
  ) {
    return this.periodService.reopenPeriod(parseInt(year, 10), parseInt(month, 10), reopenReason, user);
  }

  @Post("fiscal-years/:year/close")
  async closeFiscalYear(
    @Param("year") year: string,
    @Body("taxEstimated") taxEstimated: number,
    @CurrentUser() user: any,
  ) {
    return this.periodService.closeFiscalYear(parseInt(year, 10), Number(taxEstimated || 0), user);
  }

  @Post("fiscal-years/:year/reopen")
  async reopenFiscalYear(
    @Param("year") year: string,
    @Body("reopenReason") reopenReason: string,
    @CurrentUser() user: any,
  ) {
    return this.periodService.reopenFiscalYear(parseInt(year, 10), reopenReason, user);
  }

  @Get("tax/summary")
  async getTaxSummary(@Query("year") year?: string, @Query("month") month?: string) {
    const now = new Date();
    const y = year ? parseInt(year, 10) : now.getFullYear();
    const m = month ? parseInt(month, 10) : now.getMonth() + 1;
    return this.taxService.getTaxSummary(y, m);
  }

  @Post("tax/vat-settlement")
  async settleVat(@Body() body: any, @CurrentUser() user: any) {
    return this.taxService.settleVat(body, user);
  }

  @Post("tax/withholding-remittance")
  async remitWithholding(@Body() body: any, @CurrentUser() user: any) {
    return this.taxService.remitWithholding(body, user);
  }

  @Post("returns/sales")
  async createSalesReturn(@Body() body: any, @CurrentUser() user: any) {
    return this.postingService.postSalesReturn(body, user?.id);
  }

  @Post("returns/purchase")
  async createPurchaseReturn(@Body() body: any, @CurrentUser() user: any) {
    return this.postingService.postPurchaseReturn(body, user?.id);
  }

  @Get("ledger")
  async getLedger(
    @Query("accountCode") accountCode?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.reportService.getGeneralLedger({ accountCode, startDate, endDate });
  }

  @Get("trial-balance")
  async getTrialBalance(@Query("asOfDate") asOfDate?: string) {
    return this.reportService.getTrialBalance({ asOfDate });
  }

  @Get("income-statement")
  async getIncomeStatement(
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return this.reportService.getIncomeStatement({
      startDate: startDate || firstDay.toISOString(),
      endDate: endDate || now.toISOString(),
    });
  }

  @Get("balance-sheet")
  async getBalanceSheet(@Query("asOfDate") asOfDate?: string) {
    return this.reportService.getBalanceSheet({ asOfDate });
  }

  @Get("cash-flow")
  async getCashFlow(
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return this.reportService.getCashFlow({
      startDate: startDate || firstDay.toISOString(),
      endDate: endDate || now.toISOString(),
    });
  }

  @Get("reconcile/inventory")
  async reconcileInventory() {
    return this.reportService.reconcileInventory();
  }
}
