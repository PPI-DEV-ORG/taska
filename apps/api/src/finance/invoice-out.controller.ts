import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { IsIn } from "class-validator";
import { InvoiceOutService } from "./invoice-out.service.js";
import { FinanceListQuery, InvoiceOutDto, PaymentDto } from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { Public } from "../common/decorators/public.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

class StatusOnlyDto {
  @IsIn(["DRAFT", "SENT", "PARTIAL", "PAID", "OVERDUE", "BATAL"])
  status!: "DRAFT" | "SENT" | "PARTIAL" | "PAID" | "OVERDUE" | "BATAL";
}

@Controller("invoices")
export class InvoiceOutController {
  constructor(private readonly service: InvoiceOutService) {}

  @Post("extract-file")
  @Require("financeOut", "C")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 50 * 1024 * 1024 } }))
  extractFile(
    @UploadedFile() file: { buffer: Buffer; originalname?: string } | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException("File invoice (.xlsx / .pdf) wajib diunggah");
    return this.service.extractFile(file.buffer, file.originalname, user);
  }

  @Post(":id/upload-excel")
  @Require("financeOut", "U")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 50 * 1024 * 1024 } }))
  uploadExcel(
    @Param("id", ParseIntPipe) id: number,
    @UploadedFile() file: { buffer: Buffer; originalname?: string } | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException("File invoice (.xlsx / .pdf) wajib diunggah");
    return this.service.uploadExcel(id, file.buffer, file.originalname, user);
  }

  @Get()
  @Require("financeOut", "L")
  list(@Query() q: FinanceListQuery, @CurrentUser() user: RequestUser) {
    return this.service.list(q, user);
  }

  @Get("suggest-number")
  @Require("financeOut", "L")
  suggestNumber() {
    return this.service.suggestNumber();
  }

  @Get("efaktur/export")
  @Require("financeOut", "L")
  async exportEfaktur(
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("month") month?: string,
    @Query("year") year?: string,
    @Query("customerId") customerId?: string,
    @Query("invoiceId") invoiceId?: string,
    @Query("nsfpStart") nsfpStart?: string,
    @CurrentUser() user?: RequestUser,
    @Res() res?: Response,
  ) {
    if (user && !["super_admin", "bos", "finance"].includes(user.role)) {
      throw new ForbiddenException("Ekspor E-Faktur DJP hanya dapat diakses oleh Finance, Bos, dan Super Admin");
    }
    const { csv, filename } = await this.service.exportEfakturCsv({
      from,
      to,
      month: month ? parseInt(month, 10) : undefined,
      year: year ? parseInt(year, 10) : undefined,
      customerId: customerId ? parseInt(customerId, 10) : undefined,
      invoiceId: invoiceId ? parseInt(invoiceId, 10) : undefined,
      nsfpStart,
    });
    res?.setHeader("Content-Type", "text/csv; charset=utf-8");
    res?.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res?.end(csv);
  }

  @Public()
  @Get(":id/excel")
  async downloadExcel(@Param("id", ParseIntPipe) id: number, @Res() res: Response) {
    const { buffer, filename } = await this.service.exportExcel(id);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.end(buffer);
  }

  @Public()
  @Get(":id/pdf")
  async downloadPdf(@Param("id", ParseIntPipe) id: number, @Res() res: Response) {
    const { buffer, filename } = await this.service.exportPdf(id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.end(buffer);
  }

  @Get(":id")
  @Require("financeOut", "L")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Post()
  @Require("financeOut", "C")
  create(@Body() dto: InvoiceOutDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Put(":id")
  @Require("financeOut", "U")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: InvoiceOutDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user);
  }

  @Patch(":id")
  @Require("financeOut", "U")
  patch(@Param("id", ParseIntPipe) id: number, @Body() dto: InvoiceOutDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user);
  }

  @Post(":id/status")
  @Require("financeOut", "U")
  setStatus(@Param("id", ParseIntPipe) id: number, @Body() dto: StatusOnlyDto, @CurrentUser() user: RequestUser) {
    return this.service.setStatus(id, dto.status, user);
  }

  @Post(":id/payments")
  @Require("financeOut", "C")
  pay(@Param("id", ParseIntPipe) id: number, @Body() dto: PaymentDto, @CurrentUser() user: RequestUser) {
    return this.service.addPayment(id, dto, user);
  }

  @Delete(":id")
  @Require("financeOut", "A")
  remove(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user);
  }
}
