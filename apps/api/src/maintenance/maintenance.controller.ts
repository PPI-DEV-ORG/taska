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
import { MaintenanceService } from "./maintenance.service.js";
import {
  MaintenanceActionItemDto,
  MaintenanceListQuery,
  MaintenanceReportDto,
  MaintenanceStatusDto,
} from "./dto.js";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { Require } from "../common/decorators/require-permission.decorator.js";

@Controller("maintenance-reports")
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  @Get()
  @Require("maintenanceReports", "L")
  list(@Query() q: MaintenanceListQuery, @CurrentUser() user: RequestUser) {
    return this.service.list(q, user);
  }

  @Get(":id")
  @Require("maintenanceReports", "L")
  get(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.get(id, user);
  }

  @Post()
  @Require("maintenanceReports", "C")
  create(@Body() dto: MaintenanceReportDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Patch(":id")
  @Require("maintenanceReports", "U")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: MaintenanceReportDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Post(":id/status")
  @Patch(":id/status")
  @Require("maintenanceReports", "U")
  updateStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: MaintenanceStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateStatus(id, dto, user);
  }

  @Delete(":id")
  @Require("maintenanceReports", "U")
  remove(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user);
  }

  // ────────────────────────────── Action Items ──────────────────────────────

  @Post(":id/actions")
  @Require("maintenanceReports", "U")
  addAction(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: MaintenanceActionItemDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.addActionItem(id, dto, user);
  }

  @Patch(":id/actions/:actionId")
  @Require("maintenanceReports", "U")
  updateAction(
    @Param("id", ParseIntPipe) _id: number,
    @Param("actionId", ParseIntPipe) actionId: number,
    @Body() dto: Partial<MaintenanceActionItemDto>,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateActionItem(actionId, dto, user);
  }

  @Delete(":id/actions/:actionId")
  @Require("maintenanceReports", "U")
  deleteAction(
    @Param("id", ParseIntPipe) _id: number,
    @Param("actionId", ParseIntPipe) actionId: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.deleteActionItem(actionId, user);
  }
}
