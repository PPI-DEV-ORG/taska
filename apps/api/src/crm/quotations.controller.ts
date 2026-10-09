import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from "@nestjs/common";
import { IsInt, IsOptional, IsString } from "class-validator";
import { QuotationsService } from "./quotations.service.js";
import { CrmListQuery, QuotationDto, StatusDto, VersionDto } from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

class LeadRefDto {
  @IsInt()
  leadId!: number;
}

class AttachDto {
  @IsInt()
  fileId!: number;

  @IsOptional() @IsString()
  note?: string;
}

@Controller("quotations")
export class QuotationsController {
  constructor(private readonly service: QuotationsService) {}

  @Get()
  @Require("quotations", "L")
  list(@Query() q: CrmListQuery) {
    return this.service.list(q);
  }

  @Get("suggest-number")
  @Require("quotations", "L")
  suggestNumber() {
    return this.service.suggestNumber();
  }

  @Get(":id")
  @Require("quotations", "L")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Post()
  @Require("quotations", "C")
  createForLead(@Body() dto: LeadRefDto, @CurrentUser() user: RequestUser) {
    return this.service.createForLead(dto.leadId, user);
  }

  @Put(":id")
  @Require("quotations", "U")
  fill(@Param("id", ParseIntPipe) id: number, @Body() dto: QuotationDto, @CurrentUser() user: RequestUser) {
    return this.service.fill(id, dto, user);
  }

  @Post(":id/submit")
  @Require("quotations", "U")
  submit(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.submit(id, user);
  }

  @Post(":id/send")
  @Require("quotations", "U")
  send(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.send(id, user);
  }

  @Post(":id/status")
  @Require("quotations", "U")
  setStatus(@Param("id", ParseIntPipe) id: number, @Body() dto: StatusDto, @CurrentUser() user: RequestUser) {
    return this.service.setStatus(id, dto.status, user);
  }

  @Post(":id/versions")
  @Require("quotations", "U")
  addVersion(@Param("id", ParseIntPipe) id: number, @Body() dto: VersionDto, @CurrentUser() user: RequestUser) {
    return this.service.addVersion(id, dto, user);
  }
}
