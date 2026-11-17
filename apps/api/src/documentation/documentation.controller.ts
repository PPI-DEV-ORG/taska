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

const ENTITY_KINDS = ["survey", "project", "delivery-note", "poc", "visit", "maintenance"] as const;
export type DocKind = (typeof ENTITY_KINDS)[number];

class AttachItemDto {
  @IsInt()
  fileId!: number;

  @IsOptional() @IsString()
  caption?: string;
}

class AttachDto {
  @IsOptional() @IsInt()
  fileId?: number;

  @IsInt()
  entityId!: number;

  @IsOptional() @IsString()
  caption?: string;

  @IsOptional()
  items?: AttachItemDto[];

  @IsOptional()
  fileIds?: number[];
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
    const kind = assertKind(kindRaw);
    if (Array.isArray(dto.items) && dto.items.length > 0) {
      return this.service.attachMany(kind, dto.entityId, dto.items, user);
    }
    if (Array.isArray(dto.fileIds) && dto.fileIds.length > 0) {
      return this.service.attachMany(
        kind,
        dto.entityId,
        dto.fileIds.map((fId) => ({ fileId: fId, caption: dto.caption })),
        user,
      );
    }
    if (!dto.fileId) {
      throw new BadRequestException("fileId atau items wajib diisi");
    }
    return this.service.attach(kind, dto.entityId, dto.fileId, dto.caption, user);
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
