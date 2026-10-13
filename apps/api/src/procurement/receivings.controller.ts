import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ReceivingsService } from "./receivings.service.js";
import { IssueDto, ReceivingDto, ReceivingListQuery } from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";
import { PageQuery } from "../common/dto/page-query.js";
import { IsIn, IsOptional, IsString } from "class-validator";

class IssueListQuery extends PageQuery {
  @IsOptional() @IsIn(["DILAPORKAN", "DIPROSES", "SELESAI"])
  status?: "DILAPORKAN" | "DIPROSES" | "SELESAI";
}

class ReceivingStatusDto {
  @IsString()
  status!: string;
}

@Controller("receivings")
export class ReceivingsController {
  constructor(private readonly service: ReceivingsService) {}

  @Get()
  @Require("receiving", "L")
  list(@Query() q: ReceivingListQuery) {
    return this.service.list(q);
  }

  @Get("suggest-number")
  @Require("receiving", "L")
  suggestNumber() {
    return this.service.suggestNumber();
  }

  @Get(":id")
  @Require("receiving", "L")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Post()
  @Require("receiving", "C")
  create(@Body() dto: ReceivingDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Patch(":id")
  @Require("receiving", "U")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: ReceivingDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user);
  }

  @Post(":id/status")
  @Require("receiving", "U")
  setStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReceivingStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.setStatus(id, dto.status, user);
  }

  @Post(":id/issues")
  @Require("receiving", "C")
  reportIssue(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: IssueDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.reportIssue(id, dto, user);
  }

  @Delete(":id")
  @Require("receiving", "A")
  remove(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user);
  }
}

@Controller("issues")
export class IssuesController {
  constructor(private readonly service: ReceivingsService) {}

  @Get()
  @Require("receiving", "L")
  list(@Query() q: IssueListQuery) {
    return this.service.listIssues(q);
  }
}
