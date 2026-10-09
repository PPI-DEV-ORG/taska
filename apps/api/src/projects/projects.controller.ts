import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ProjectsService } from "./projects.service.js";
import { AssignDto, MemberDto, ProjectDto, ProjectListQuery, ProjectStatusDto, RequirementDto } from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get()
  @Require("projects", "L")
  list(@Query() q: ProjectListQuery, @CurrentUser() user: RequestUser) {
    return this.service.list(q, user);
  }

  @Get(":id")
  @Require("projects", "L")
  get(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.get(id, user);
  }

  @Post()
  @Require("projects", "C")
  create(@Body() dto: ProjectDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Put(":id")
  @Require("projects", "U")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: ProjectDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user);
  }

  @Post(":id/status")
  @Require("projects", "U")
  setStatus(@Param("id", ParseIntPipe) id: number, @Body() dto: ProjectStatusDto, @CurrentUser() user: RequestUser) {
    return this.service.setStatus(id, dto, user);
  }

  @Post(":id/reassign")
  @Require("projects", "U")
  reassign(@Param("id", ParseIntPipe) id: number, @Body() dto: AssignDto, @CurrentUser() user: RequestUser) {
    return this.service.reassign(id, dto, user);
  }

  @Post(":id/members")
  @Require("projects", "U")
  addMember(@Param("id", ParseIntPipe) id: number, @Body() dto: MemberDto, @CurrentUser() user: RequestUser) {
    return this.service.addMember(id, dto, user);
  }

  @Delete(":id/members/:userId")
  @Require("projects", "U")
  removeMember(
    @Param("id", ParseIntPipe) id: number,
    @Param("userId", ParseIntPipe) userId: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.removeMember(id, userId, user);
  }

  @Get(":id/requirements")
  @Require("projects", "L")
  listRequirements(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.listRequirements(id, user);
  }

  @Post(":id/requirements")
  @Require("projects", "C")
  addRequirement(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RequirementDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.addRequirement(id, dto, user);
  }

  @Put(":id/requirements/:reqId")
  @Require("projects", "U")
  updateRequirement(
    @Param("id", ParseIntPipe) id: number,
    @Param("reqId", ParseIntPipe) reqId: number,
    @Body() dto: RequirementDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateRequirement(id, reqId, dto, user);
  }

  @Delete(":id/requirements/:reqId")
  @Require("projects", "U")
  removeRequirement(
    @Param("id", ParseIntPipe) id: number,
    @Param("reqId", ParseIntPipe) reqId: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.removeRequirement(id, reqId, user);
  }
}
