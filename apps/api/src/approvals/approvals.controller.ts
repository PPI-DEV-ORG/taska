import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { ApprovalsService } from "./approvals.service.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";
import { PageQuery } from "../common/dto/page-query.js";

class DecisionDto {
  @IsBoolean()
  approve!: boolean;

  @IsOptional() @IsString()
  reason?: string;
}

class ApprovalQuery extends PageQuery {
  status?: string;
  kind?: string;
}

@Controller("approvals")
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  @Require("approvals", "L")
  list(@Query() q: ApprovalQuery) {
    return this.approvals.list({ page: q.page, limit: q.limit, status: q.status, kind: q.kind, q: q.q });
  }

  @Get("pending")
  @Require("approvals", "L")
  pending(@CurrentUser() user: RequestUser) {
    return this.approvals.pendingFor(user);
  }

  @Get("entity/:kind/:entityId")
  @Require("approvals", "L")
  forEntity(@Param("kind") kind: string, @Param("entityId", ParseIntPipe) entityId: number) {
    return this.approvals.getFor(kind as never, entityId);
  }

  @Post(":id/decide")
  @Require("approvals", "A")
  @HttpCode(200)
  decide(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: DecisionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.approvals.decide(id, user, dto.approve, dto.reason);
  }
}
