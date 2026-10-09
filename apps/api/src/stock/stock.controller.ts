import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { MovementsService } from "./movements.service.js";
import { SerialsService } from "./serials.service.js";
import { OpnameService } from "./opname.service.js";
import { ReservationsService } from "./reservations.service.js";
import { DamagesService } from "./damages.service.js";
import {
  DamageCreateDto,
  DamageListQuery,
  DamageStatusDto,
  MovementListQuery,
  OpnameCreateDto,
  OpnameSubmitDto,
  ReservationCreateDto,
  ReservationListQuery,
  ReplaceSerialDto,
  SerialListQuery,
  SerialStatusDto,
  SummaryQuery,
  TransferDto,
} from "./dto.js";
import type { OpnameListQuery } from "./opname.service.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";
import { IsIn, IsInt, IsOptional } from "class-validator";
import { Type } from "class-transformer";
import { PageQuery } from "../common/dto/page-query.js";

class OpnameQuery extends PageQuery {
  @IsOptional() @IsIn(["DRAFT", "MENUNGGU_PERSETUJUAN", "DISETUJUI", "DITOLAK"])
  status?: "DRAFT" | "MENUNGGU_PERSETUJUAN" | "DISETUJUI" | "DITOLAK";

  @IsOptional() @Type(() => Number) @IsInt()
  warehouseId?: number;
}

@Controller("movements")
export class MovementsController {
  constructor(private readonly service: MovementsService) {}

  @Get()
  @Require("stock", "L")
  list(@Query() q: MovementListQuery) {
    return this.service.list(q);
  }

  @Post("transfer")
  @Require("stock", "C")
  transfer(@Body() dto: TransferDto, @CurrentUser() user: RequestUser) {
    return this.service.transfer(dto, user);
  }
}

@Controller("stock")
export class StockController {
  constructor(private readonly service: MovementsService) {}

  @Get("summary")
  @Require("stock", "L")
  summary(@Query() q: SummaryQuery) {
    return this.service.summary(q);
  }
}

@Controller("serials")
export class SerialsController {
  constructor(private readonly service: SerialsService) {}

  @Get()
  @Require("stock", "L")
  list(@Query() q: SerialListQuery) {
    return this.service.list(q);
  }

  @Get(":id")
  @Require("stock", "L")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Post(":id/status")
  @Require("stock", "U")
  setStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SerialStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.setStatus(id, dto, user);
  }

  @Post(":id/replace")
  @Require("stock", "U")
  replace(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReplaceSerialDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.replace(id, dto, user);
  }
}

@Controller("opnames")
export class OpnamesController {
  constructor(private readonly service: OpnameService) {}

  @Get()
  @Require("stock", "L")
  list(@Query() q: OpnameQuery) {
    return this.service.list(q as OpnameListQuery);
  }

  @Get(":id")
  @Require("stock", "L")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Post()
  @Require("stock", "C")
  create(@Body() dto: OpnameCreateDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Post(":id/submit")
  @Require("stock", "U")
  submit(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: OpnameSubmitDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.submit(id, dto, user);
  }
}

@Controller("reservations")
export class ReservationsController {
  constructor(private readonly service: ReservationsService) {}

  @Get()
  @Require("stock", "L")
  list(@Query() q: ReservationListQuery) {
    return this.service.list(q);
  }

  @Post()
  @Require("stock", "C")
  create(@Body() dto: ReservationCreateDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Post(":id/release")
  @Require("stock", "U")
  release(@Param("id", ParseIntPipe) id: number) {
    return this.service.release(id);
  }
}

@Controller("damages")
export class DamagesController {
  constructor(private readonly service: DamagesService) {}

  @Get()
  @Require("stock", "L")
  list(@Query() q: DamageListQuery) {
    return this.service.list(q);
  }

  @Post()
  @Require("stock", "C")
  create(@Body() dto: DamageCreateDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Post(":id/status")
  @Require("stock", "U")
  setStatus(@Param("id", ParseIntPipe) id: number, @Body() dto: DamageStatusDto) {
    return this.service.setStatus(id, dto.status);
  }
}
