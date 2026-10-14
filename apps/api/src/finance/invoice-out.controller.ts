import { Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { IsIn } from "class-validator";
import { InvoiceOutService } from "./invoice-out.service.js";
import { FinanceListQuery, InvoiceOutDto, PaymentDto } from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

class StatusOnlyDto {
  @IsIn(["DRAFT", "SENT", "PARTIAL", "PAID", "OVERDUE", "BATAL"])
  status!: "DRAFT" | "SENT" | "PARTIAL" | "PAID" | "OVERDUE" | "BATAL";
}

@Controller("invoices")
export class InvoiceOutController {
  constructor(private readonly service: InvoiceOutService) {}

  @Get()
  @Require("financeOut", "L")
  list(@Query() q: FinanceListQuery) {
    return this.service.list(q);
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
