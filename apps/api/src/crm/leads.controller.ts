import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { IsInt } from "class-validator";
import { LeadsService } from "./leads.service.js";
import { CrmListQuery, LeadDto } from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

class ReassignDto {
  @IsInt()
  ownerId!: number;
}

@Controller("leads")
export class LeadsController {
  constructor(private readonly service: LeadsService) {}

  @Get()
  @Require("leads", "L")
  list(@Query() q: CrmListQuery) {
    return this.service.list(q);
  }

  @Get(":id")
  @Require("leads", "L")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Post()
  @Require("leads", "C")
  create(@Body() dto: LeadDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Patch(":id")
  @Require("leads", "U")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: LeadDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user);
  }

  @Patch(":id/reassign")
  @Require("leads", "U")
  reassign(@Param("id", ParseIntPipe) id: number, @Body() dto: ReassignDto, @CurrentUser() user: RequestUser) {
    return this.service.reassign(id, dto.ownerId, user);
  }
}
