import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { QuotationsService } from "./quotations.service.js";
import { CrmListQuery, QuotationDto, StatusDto, VersionDto } from "./dto.js";
import { Public } from "../common/decorators/public.decorator.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

class CreateQuotationDto extends QuotationDto {}

type Uploaded = { buffer: Buffer; originalname?: string };

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

  @Public()
  @Get("template-excel")
  async downloadTemplateExcel(
    @Query("leadId") leadId: string | undefined,
    @Query("customer") customer: string | undefined,
    @Query("lead") lead: string | undefined,
    @Query("nomor") nomor: string | undefined,
    @Query("signer") signer: string | undefined,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.service.exportTemplateExcel({
      leadId: leadId ? Number(leadId) : undefined,
      customer,
      lead,
      nomor,
      signer,
    });
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.end(buffer);
  }

  @Public()
  @Get(":id/excel")
  async downloadExcel(@Param("id", ParseIntPipe) id: number, @Res() res: Response) {
    const { buffer, filename } = await this.service.exportExcel(id);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.end(buffer);
  }

  @Get(":id")
  @Require("quotations", "L")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Post()
  @Require("quotations", "C")
  createForLead(@Body() dto: CreateQuotationDto, @CurrentUser() user: RequestUser) {
    return this.service.createForLead(dto.leadId, user, dto);
  }

  @Post(":id/upload-excel")
  @Require("quotations", "U")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 50 * 1024 * 1024 } }))
  uploadExcel(
    @Param("id", ParseIntPipe) id: number,
    @UploadedFile() file: Uploaded | undefined,
    @Headers("x-file-name") fileName: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("File penawaran (.xlsx / .pdf) wajib diunggah");
    }
    return this.service.uploadExcel(id, file.buffer, fileName ?? file.originalname, user);
  }

  @Put(":id")
  @Require("quotations", "U")
  fill(@Param("id", ParseIntPipe) id: number, @Body() dto: QuotationDto, @CurrentUser() user: RequestUser) {
    return this.service.fill(id, dto, user);
  }

  @Patch(":id")
  @Require("quotations", "U")
  patch(@Param("id", ParseIntPipe) id: number, @Body() dto: QuotationDto, @CurrentUser() user: RequestUser) {
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

  @Delete(":id")
  @Require("quotations", "A")
  remove(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user);
  }
}
