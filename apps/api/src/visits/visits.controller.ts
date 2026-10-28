import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { VisitsService } from "./visits.service.js";
import {
  VisitActionItemDto,
  VisitListQuery,
  VisitReportDto,
  VisitStatusDto,
} from "./dto.js";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { Require } from "../common/decorators/require-permission.decorator.js";

@Controller("visit-reports")
export class VisitsController {
  constructor(private readonly service: VisitsService) {}

  @Get()
  @Require("visitReports", "L")
  list(@Query() q: VisitListQuery, @CurrentUser() user: RequestUser) {
    return this.service.list(q, user);
  }

  @Get(":id")
  @Require("visitReports", "L")
  get(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.get(id, user);
  }

  @Post()
  @Require("visitReports", "C")
  create(@Body() dto: VisitReportDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Patch(":id")
  @Require("visitReports", "U")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: VisitReportDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Post(":id/status")
  @Patch(":id/status")
  @Require("visitReports", "U")
  updateStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: VisitStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateStatus(id, dto, user);
  }

  @Delete(":id")
  @Require("visitReports", "U")
  remove(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user);
  }

  // ────────────────────────────── Action Items ──────────────────────────────

  @Post(":id/actions")
  @Require("visitReports", "U")
  addAction(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: VisitActionItemDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.addActionItem(id, dto, user);
  }

  @Patch(":id/actions/:actionId")
  @Require("visitReports", "U")
  updateAction(
    @Param("id", ParseIntPipe) _id: number,
    @Param("actionId", ParseIntPipe) actionId: number,
    @Body() dto: Partial<VisitActionItemDto>,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateActionItem(actionId, dto, user);
  }

  @Delete(":id/actions/:actionId")
  @Require("visitReports", "U")
  deleteAction(
    @Param("id", ParseIntPipe) _id: number,
    @Param("actionId", ParseIntPipe) actionId: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.deleteActionItem(actionId, user);
  }
}

