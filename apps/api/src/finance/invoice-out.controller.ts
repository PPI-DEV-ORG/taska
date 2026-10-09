import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from "@nestjs/common";
import { IsIn } from "class-validator";
import { InvoiceOutService } from "./invoice-out.service.js";
import { FinanceListQuery, InvoiceOutDto, PaymentDto } from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

class StatusOnlyDto {
  @IsIn(["DRAFT", "SENT", "BATAL"])
  status!: "DRAFT" | "SENT" | "BATAL";
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
}
