import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put } from "@nestjs/common";
import { TasksService } from "./tasks.service.js";
import { AssignDto, TaskDto, TaskStatusDto } from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

@Controller("projects/:projectId/tasks")
export class ProjectTasksController {
  constructor(private readonly service: TasksService) {}

  @Get()
  @Require("tasks", "L")
  tree(@Param("projectId", ParseIntPipe) projectId: number, @CurrentUser() user: RequestUser) {
    return this.service.tree(projectId, user);
  }

  @Post()
  @Require("tasks", "C")
  create(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Body() dto: TaskDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.create(projectId, dto, user);
  }
}

@Controller("tasks")
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Get()
  @Require("tasks", "L")
  listAll(@CurrentUser() user: RequestUser) {
    return this.service.listAll(user);
  }

  @Get(":id")
  @Require("tasks", "L")
  get(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.get(id, user);
  }

  @Put(":id")
  @Require("tasks", "U")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: TaskDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user);
  }

  @Patch(":id")
  @Require("tasks", "U")
  patch(@Param("id", ParseIntPipe) id: number, @Body() dto: TaskDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user);
  }

  @Post(":id/status")
  @Require("tasks", "U")
  setStatus(@Param("id", ParseIntPipe) id: number, @Body() dto: TaskStatusDto, @CurrentUser() user: RequestUser) {
    return this.service.setStatus(id, dto, user);
  }

  @Post(":id/reassign")
  @Require("tasks", "U")
  reassign(@Param("id", ParseIntPipe) id: number, @Body() dto: AssignDto, @CurrentUser() user: RequestUser) {
    return this.service.reassign(id, dto, user);
  }

  @Delete(":id")
  @Require("tasks", "U")
  remove(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user);
  }
}
