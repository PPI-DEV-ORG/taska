import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { FollowUpsService } from "./follow-ups.service.js";
import { CrmListQuery, FollowUpDto } from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

@Controller("follow-ups")
export class FollowUpsController {
  constructor(private readonly service: FollowUpsService) {}

  @Get()
  @Require("leads", "L")
  list(@Query() q: CrmListQuery) {
    return this.service.list(q);
  }

  @Post()
  @Require("leads", "C")
  create(@Body() dto: FollowUpDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Patch(":id")
  @Require("leads", "U")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: FollowUpDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user);
  }
}
