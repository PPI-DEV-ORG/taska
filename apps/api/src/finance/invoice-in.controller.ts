import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from "@nestjs/common";
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
  @Require("procurement", "L")
  list(@Query() q: FinanceListQuery) {
    return this.service.list(q);
  }

  @Get("suggest-number")
  @Require("procurement", "L")
  suggestNumber() {
    return this.service.suggestNumber();
  }

  @Get(":id")
  @Require("procurement", "L")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Post()
  @Require("procurement", "C")
  create(@Body() dto: InvoiceInDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Put(":id")
  @Require("procurement", "U")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: InvoiceInDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user);
  }

  @Post(":id/status")
  @Require("procurement", "U")
  setStatus(@Param("id", ParseIntPipe) id: number, @Body() dto: StatusOnlyDto, @CurrentUser() user: RequestUser) {
    return this.service.setStatus(id, dto.status, user);
  }

  @Post(":id/payments")
  @Require("procurement", "U")
  pay(@Param("id", ParseIntPipe) id: number, @Body() dto: PaymentDto, @CurrentUser() user: RequestUser) {
    return this.service.addPayment(id, dto, user);
  }
}
