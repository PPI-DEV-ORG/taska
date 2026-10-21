import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";
import { PageQuery } from "../common/dto/page-query.js";

export class DeliveryListQuery extends PageQuery {
  @IsOptional() @IsIn(["PENDING", "DIKIRIM", "DITERIMA", "DIBATALKAN"])
  status?: "PENDING" | "DIKIRIM" | "DITERIMA" | "DIBATALKAN";

  @IsOptional() @IsIn(["true", "false"])
  withGoods?: "true" | "false";

  @IsOptional() @Type(() => Number) @IsInt()
  creatorId?: number;

  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;
}

export class LocationDto {
  @IsString() @MinLength(1)
  destination: string;

  @IsString() @MinLength(1)
  reason: string;

  @IsOptional() @Type(() => Number) @IsInt()
  projectId?: number;
}

export class DeliveryItemDto {
  @Type(() => Number)
  @IsInt()
  productId: number;

  @Type(() => Number)
  @IsInt()
  qty: number;

  @IsOptional()
  @IsString()
  serials?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class DeliveryCreateDto {
  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional() @IsIn(["true", "false", true, false])
  withGoods?: boolean | "true" | "false";

  @IsOptional() @IsString()
  number?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  warehouseId?: number;

  @IsOptional() @IsIn(["PENDING", "DIKIRIM", "DITERIMA", "DIBATALKAN"])
  status?: "PENDING" | "DIKIRIM" | "DITERIMA" | "DIBATALKAN";

  @IsOptional() @IsString()
  reportText?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  reportFileId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  scanFileId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  fileId?: number;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => LocationDto)
  locations?: LocationDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => DeliveryItemDto)
  items?: DeliveryItemDto[];
}

export class GoodsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serials?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliveryItemDto)
  items?: DeliveryItemDto[];
}

export class DeliveryStatusDto {
  @IsIn(["PENDING", "DIKIRIM", "DITERIMA", "DIBATALKAN"])
  status: "PENDING" | "DIKIRIM" | "DITERIMA" | "DIBATALKAN";

  @IsOptional() @IsString()
  reason?: string;
}

export class DeliveryReportDto {
  @IsString() @MinLength(1)
  reportText: string;

  @IsOptional() @Type(() => Number) @IsInt()
  reportFileId?: number;
}
