import { Controller, ForbiddenException, Get, Param, Query, StreamableFile } from "@nestjs/common";
import { ReportsService, REPORT_TYPES } from "./reports.service.js";
import { exportMeta, toDocx, toPdf, toXlsx } from "./exporters.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";
import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";

class ReportQueryDto {
  @IsOptional() @IsString()
  q?: string;

  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;

  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsString()
  stage?: string;

  @IsOptional() @IsString()
  warehouseId?: string;

  @IsOptional() @IsIn(["overdue", "today", "all"])
  due?: "overdue" | "today" | "all";
}

class ExportQueryDto extends ReportQueryDto {
  @IsOptional() @IsIn(["xlsx", "pdf", "docx"])
  format?: "xlsx" | "pdf" | "docx";
}

const FINANCIAL_REPORT_TYPES = new Set([
  "profit-loss",
  "income-statement",
  "balance-sheet",
  "cash-flow",
  "general-journal",
]);

function canAccessFinancialReports(user?: RequestUser): boolean {
  const r = (user?.role ?? "").toLowerCase();
  return ["super_admin", "admin", "bos", "finance"].includes(r);
}

@Controller("reports")
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get()
  @Require("reports", "L")
  types(@CurrentUser() user?: RequestUser) {
    const isFinancial = canAccessFinancialReports(user);
    const available = isFinancial
      ? REPORT_TYPES
      : REPORT_TYPES.filter((t) => !FINANCIAL_REPORT_TYPES.has(t));
    return { reports: available };
  }

  @Get("archive")
  @Require("reports", "L")
  archive(@Query("q") q?: string, @Query("year") year?: string, @Query("category") category?: string) {
    return this.service.archiveList({ q, year, category });
  }

  @Get(":type/export")
  @Require("reports", "L")
  async export(
    @Param("type") type: string,
    @Query() q: ExportQueryDto,
    @CurrentUser() user?: RequestUser,
  ): Promise<StreamableFile> {
    if (FINANCIAL_REPORT_TYPES.has(type) && !canAccessFinancialReports(user)) {
      throw new ForbiddenException("Laporan Keuangan & Akuntansi hanya dapat diakses oleh Finance, Admin, Bos, dan Super Admin");
    }
    const data = await this.service.build(type, q);
    const format = q.format ?? "xlsx";
    const meta = exportMeta(format, data.title);
    const buffer =
      format === "xlsx" ? await toXlsx(data) : format === "pdf" ? await toPdf(data) : await toDocx(data);
    return new StreamableFile(buffer, {
      type: meta.mime,
      disposition: `attachment; filename="${meta.filename}"`,
    });
  }

  @Get(":type")
  @Require("reports", "L")
  data(
    @Param("type") type: string,
    @Query() q: ReportQueryDto,
    @CurrentUser() user?: RequestUser,
  ) {
    if (FINANCIAL_REPORT_TYPES.has(type) && !canAccessFinancialReports(user)) {
      throw new ForbiddenException("Laporan Keuangan & Akuntansi hanya dapat diakses oleh Finance, Admin, Bos, dan Super Admin");
    }
    return this.service.build(type, q);
  }
}
