import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { FollowUpsService } from "./follow-ups.service.js";
import { CrmListQuery, FollowUpDto, UpdateFollowUpDto } from "./dto.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

@Controller("follow-ups")
export class FollowUpsController {
  constructor(private readonly service: FollowUpsService) {}

  @Get()
  list(@Query() q: CrmListQuery) {
    return this.service.list(q);
  }

  @Post()
  create(@Body() dto: FollowUpDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateFollowUpDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user);
  }
}
