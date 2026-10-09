import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { IsInt } from "class-validator";
import { SurveysService } from "./surveys.service.js";
import { CrmListQuery, SurveyDto, SurveyStatusDto } from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

class AttachDto {
  @IsInt()
  fileId!: number;
}

@Controller("surveys")
export class SurveysController {
  constructor(private readonly service: SurveysService) {}

  @Get()
  @Require("surveys", "L")
  list(@Query() q: CrmListQuery, @CurrentUser() user: RequestUser) {
    return this.service.list(q, user);
  }

  @Get(":id")
  @Require("surveys", "L")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Post()
  @Require("surveys", "C")
  create(@Body() dto: SurveyDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Patch(":id")
  @Require("surveys", "U")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SurveyDto | SurveyStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Get(":id/files")
  @Require("surveys", "L")
  files(@Param("id", ParseIntPipe) id: number) {
    return this.service.get(id).then((s) => s.files);
  }

  @Post(":id/files")
  @Require("surveys", "C")
  attach(@Param("id", ParseIntPipe) id: number, @Body() dto: AttachDto, @CurrentUser() user: RequestUser) {
    return this.service.attachFile(id, dto.fileId, user);
  }
}
