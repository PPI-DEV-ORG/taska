import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { PosService } from "./pos.service.js";
import { PoDto, PoListQuery, ShipmentDto } from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

@Controller("supplier-pos")
export class PosController {
  constructor(private readonly service: PosService) {}

  @Get()
  @Require("procurement", "L")
  list(@Query() q: PoListQuery) {
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
  create(@Body() dto: PoDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Post(":id/shipment")
  @Require("procurement", "U")
  setShipment(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ShipmentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.setShipment(id, dto, user);
  }

  @Post(":id/ready")
  @Require("procurement", "U")
  declareReady(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.declareReady(id, user);
  }

  @Post(":id/cancel")
  @Require("procurement", "U")
  cancel(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.cancel(id, user);
  }
}
