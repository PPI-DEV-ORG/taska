import { Controller, Get, Query } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";
import { AuditService } from "./audit.service.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { PageQuery } from "../common/dto/page-query.js";

class AuditQuery extends PageQuery {
  @IsOptional() @IsString()
  entityType?: string;
}

@Controller("audit-logs")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Require("audit", "L")
  list(@Query() q: AuditQuery) {
    return this.audit.list({
      page: q.page,
      limit: q.limit,
      q: q.q,
      entityType: q.entityType,
    });
  }
}
