import { Controller, Get, Param, Query, StreamableFile } from "@nestjs/common";
import { ReportsService, REPORT_TYPES } from "./reports.service.js";
import { exportMeta, toDocx, toPdf, toXlsx } from "./exporters.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
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

@Controller("reports")
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get()
  @Require("reports", "L")
  types() {
    return { reports: REPORT_TYPES };
  }

  @Get(":type/export")
  @Require("reports", "L")
  async export(
    @Param("type") type: string,
    @Query() q: ExportQueryDto,
  ): Promise<StreamableFile> {
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
  data(@Param("type") type: string, @Query() q: ReportQueryDto) {
    return this.service.build(type, q);
  }
}
