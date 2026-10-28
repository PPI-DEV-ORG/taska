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
import { PocService } from "./poc.service.js";
import {
  PocChecklistDto,
  PocListQuery,
  PocReportDto,
  PocStatusDto,
} from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

@Controller("poc-reports")
export class PocController {
  constructor(private readonly service: PocService) {}

  @Get()
  @Require("pocReports", "L")
  list(@Query() q: PocListQuery, @CurrentUser() user: RequestUser) {
    return this.service.list(q, user);
  }

  @Get(":id")
  @Require("pocReports", "L")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Post()
  @Require("pocReports", "C")
  create(@Body() dto: PocReportDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Patch(":id")
  @Require("pocReports", "U")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: PocReportDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Post(":id/status")
  @Require("pocReports", "U")
  setStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: PocStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.setStatus(id, dto, user);
  }

  @Delete(":id")
  @Require("pocReports", "U")
  delete(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.delete(id, user);
  }

  // Checklist endpoints
  @Post(":id/checklists")
  @Require("pocReports", "U")
  addChecklist(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: PocChecklistDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.addChecklist(id, dto, user);
  }

  @Patch(":id/checklists/:checklistId")
  @Require("pocReports", "U")
  updateChecklist(
    @Param("id", ParseIntPipe) id: number,
    @Param("checklistId", ParseIntPipe) checklistId: number,
    @Body() dto: PocChecklistDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateChecklist(id, checklistId, dto, user);
  }

  @Post(":id/checklists/:checklistId/toggle")
  @Require("pocReports", "U")
  toggleChecklist(
    @Param("id", ParseIntPipe) id: number,
    @Param("checklistId", ParseIntPipe) checklistId: number,
    @Body("isDone") isDone: boolean,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.toggleChecklist(id, checklistId, !!isDone, user);
  }

  @Delete(":id/checklists/:checklistId")
  @Require("pocReports", "U")
  deleteChecklist(
    @Param("id", ParseIntPipe) id: number,
    @Param("checklistId", ParseIntPipe) checklistId: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.deleteChecklist(id, checklistId, user);
  }
}

