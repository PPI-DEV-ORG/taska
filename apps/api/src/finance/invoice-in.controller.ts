import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from "@nestjs/common";
import { IsIn } from "class-validator";
import { InvoiceInService } from "./invoice-in.service.js";
import { FinanceListQuery, InvoiceInDto, PaymentDto } from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

class StatusOnlyDto {
  @IsIn(["UNPAID", "BATAL"])
  status!: "UNPAID" | "BATAL";
}

@Controller("invoice-in")
export class InvoiceInController {
  constructor(private readonly service: InvoiceInService) {}

  @Get()
  @Require("supplierBills", "L")
  list(@Query() q: FinanceListQuery) {
    return this.service.list(q);
  }

  @Get("suggest-number")
  @Require("supplierBills", "L")
  suggestNumber() {
    return this.service.suggestNumber();
  }

  @Get(":id")
  @Require("supplierBills", "L")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Post()
  @Require("supplierBills", "C")
  create(@Body() dto: InvoiceInDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Put(":id")
  @Require("supplierBills", "U")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: InvoiceInDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user);
  }

  @Patch(":id")
  @Require("supplierBills", "U")
  patch(@Param("id", ParseIntPipe) id: number, @Body() dto: InvoiceInDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user);
  }

  @Post(":id/status")
  @Require("supplierBills", "U")
  setStatus(@Param("id", ParseIntPipe) id: number, @Body() dto: StatusOnlyDto, @CurrentUser() user: RequestUser) {
    return this.service.setStatus(id, dto.status, user);
  }

  @Post(":id/payments")
  @Require("supplierBills", "U")
  pay(@Param("id", ParseIntPipe) id: number, @Body() dto: PaymentDto, @CurrentUser() user: RequestUser) {
    return this.service.addPayment(id, dto, user);
  }

  /** Void pembayaran yang salah / dobel: jurnal dibalik, sisa hutang kembali. */
  @Delete(":id/payments/:paymentId")
  @Require("supplierBills", "U")
  voidPayment(
    @Param("id", ParseIntPipe) id: number,
    @Param("paymentId", ParseIntPipe) paymentId: number,
    @Query("reason") reason: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.voidPayment(id, paymentId, reason, user);
  }

  @Delete(":id")
  @Require("supplierBills", "U")
  remove(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user);
  }
}
