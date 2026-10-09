import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { RequestsService } from "./requests.service.js";
import { RequestDto, RequestListQuery, RequestStatusDto } from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

@Controller("requests")
export class RequestsController {
  constructor(private readonly service: RequestsService) {}

  @Get()
  @Require("requests", "L")
  list(@Query() q: RequestListQuery, @CurrentUser() user: RequestUser) {
    return this.service.list(q, user);
  }

  @Get("suggest-number")
  @Require("requests", "L")
  suggestNumber() {
    return this.service.suggestNumber();
  }

  @Get(":id")
  @Require("requests", "L")
  get(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.get(id, user);
  }

  @Get(":id/check-stock")
  @Require("requests", "U")
  checkStock(@Param("id", ParseIntPipe) id: number) {
    return this.service.checkStock(id);
  }

  @Post()
  @Require("requests", "C")
  create(@Body() dto: RequestDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Post(":id/status")
  @Require("requests", "U")
  setStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RequestStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.setStatus(id, dto, user);
  }
}
