import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  StreamableFile,
} from "@nestjs/common";
import { DocumentationService } from "./documentation.service.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, MinLength } from "class-validator";

const ENTITY_KINDS = ["survey", "project", "delivery-note", "poc"] as const;
export type DocKind = (typeof ENTITY_KINDS)[number];

class AttachDto {
  @IsInt()
  fileId!: number;

  @IsInt()
  entityId!: number;

  @IsOptional() @IsString() @MinLength(1)
  caption?: string;
}

class ListQueryDto {
  @IsIn(ENTITY_KINDS as unknown as string[])
  kind!: DocKind;

  @Type(() => Number)
  @IsInt()
  entityId!: number;
}

function assertKind(k: string): DocKind {
  if (!(ENTITY_KINDS as readonly string[]).includes(k)) {
    throw new BadRequestException(`Jenis dokumen tidak dikenal: ${k}`);
  }
  return k as DocKind;
}

@Controller("documentation")
export class DocumentationController {
  constructor(private readonly service: DocumentationService) {}

  @Get("photos")
  list(@Query() q: ListQueryDto, @CurrentUser() user: RequestUser) {
    return this.service.list(assertKind(q.kind), q.entityId, user);
  }

  @Post("photos")
  attach(
    @Body() dto: AttachDto,
    @Query("kind") kindRaw: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.attach(assertKind(kindRaw), dto.entityId, dto.fileId, dto.caption, user);
  }

  @Delete("photos/:id")
  remove(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user);
  }

  @Get(":kind/:id/pdf")
  async pdf(
    @Param("kind") kindRaw: string,
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ): Promise<StreamableFile> {
    const kind = assertKind(kindRaw);
    const { buffer, filename } = await this.service.renderPdf(kind, id, user);
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
