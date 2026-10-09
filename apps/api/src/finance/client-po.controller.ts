import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from "@nestjs/common";
import { ClientPoService } from "./client-po.service.js";
import { ClientPoDto, FinanceListQuery } from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

@Controller("client-po")
export class ClientPoController {
  constructor(private readonly service: ClientPoService) {}

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
  create(@Body() dto: ClientPoDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Put(":id")
  @Require("financeOut", "U")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: ClientPoDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user);
  }
}
