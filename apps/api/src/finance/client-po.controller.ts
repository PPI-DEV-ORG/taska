import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from "@nestjs/common";
import { ClientPoService } from "./client-po.service.js";
import { ClientPoDirectSettlementDto, ClientPoDto, FinanceListQuery } from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

@Controller("client-po")
export class ClientPoController {
  constructor(private readonly service: ClientPoService) {}

  @Get()
  @Require("poClient", "L")
  list(@Query() q: FinanceListQuery) {
    return this.service.list(q);
  }

  @Get("suggest-number")
  @Require("poClient", "L")
  suggestNumber() {
    return this.service.suggestNumber();
  }

  @Get(":id")
  @Require("poClient", "L")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Post()
  @Require("poClient", "C")
  create(@Body() dto: ClientPoDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Put(":id")
  @Require("poClient", "U")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: ClientPoDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user);
  }

  @Patch(":id")
  @Require("poClient", "U")
  patch(@Param("id", ParseIntPipe) id: number, @Body() dto: ClientPoDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user);
  }

  @Post(":id/direct-settlement")
  @Require("financeOut", "U")
  directSettlement(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ClientPoDirectSettlementDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.directSettlement(id, dto, user);
  }

  @Delete(":id")
  @Require("poClient", "U")
  remove(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user);
  }
}
