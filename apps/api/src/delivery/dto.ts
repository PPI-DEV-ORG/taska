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

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => LocationDto)
  locations?: LocationDto[];
}

export class GoodsDto {
  @IsArray() @IsString({ each: true }) @MinLength(1, { each: true })
  serials: string[];
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
