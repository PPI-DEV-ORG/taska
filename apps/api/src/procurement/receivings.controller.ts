import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { ReceivingsService } from "./receivings.service.js";
import { IssueDto, ReceivingDto, ReceivingListQuery } from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";
import { PageQuery } from "../common/dto/page-query.js";
import { IsIn, IsOptional } from "class-validator";

class IssueListQuery extends PageQuery {
  @IsOptional() @IsIn(["DILAPORKAN", "DIPROSES", "SELESAI"])
  status?: "DILAPORKAN" | "DIPROSES" | "SELESAI";
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

  @Post(":id/issues")
  @Require("receiving", "C")
  reportIssue(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: IssueDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.reportIssue(id, dto, user);
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
