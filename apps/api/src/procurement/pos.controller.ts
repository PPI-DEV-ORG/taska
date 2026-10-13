import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { IsString } from "class-validator";
import { PosService } from "./pos.service.js";
import { PoDto, PoListQuery, ShipmentDto } from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

class PoStatusDto {
  @IsString()
  status!: string;
}

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

  @Patch(":id")
  @Require("procurement", "U")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: PoDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user);
  }

  @Post(":id/status")
  @Require("procurement", "U")
  setStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: PoStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.setStatus(id, dto.status, user);
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

  @Delete(":id")
  @Require("procurement", "A")
  remove(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user);
  }
}
