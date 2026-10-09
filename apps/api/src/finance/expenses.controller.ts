import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ExpensesService } from "./expenses.service.js";
import { ExpenseDto, ExpenseStatusDto, FinanceListQuery } from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

@Controller("expenses")
export class ExpensesController {
  constructor(private readonly service: ExpensesService) {}

  @Get()
  @Require("expenses", "L")
  list(@Query() q: FinanceListQuery, @CurrentUser() user: RequestUser) {
    return this.service.list(q, user);
  }

  @Get("summary")
  @Require("expenses", "L")
  summary(
    @CurrentUser() user: RequestUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.summary(user, from, to);
  }

  @Get(":id")
  @Require("expenses", "L")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Post()
  @Require("expenses", "C")
  create(@Body() dto: ExpenseDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Patch(":id")
  @Require("expenses", "U")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: ExpenseDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user);
  }

  @Post(":id/status")
  @Require("expenses", "U")
  setStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ExpenseStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.setStatus(id, dto, user);
  }
}
