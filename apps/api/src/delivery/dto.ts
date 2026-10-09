import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
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
  @IsString() @MinLength(3)
  destination: string;

  @IsString() @MinLength(3)
  reason: string;

  @IsOptional() @Type(() => Number) @IsInt()
  projectId?: number;
}

export class DeliveryCreateDto {
  @IsDateString()
  date: string;

  @IsOptional() @IsIn(["true", "false", true, false])
  withGoods?: boolean | "true" | "false";

  @IsOptional() @IsString() @MinLength(2)
  number?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  warehouseId?: number;

  @IsArray() @ValidateNested({ each: true }) @Type(() => LocationDto)
  locations: LocationDto[];
}

export class GoodsDto {
  @IsArray() @IsString({ each: true }) @Min(1, { each: true })
  serials: string[];
}

export class DeliveryStatusDto {
  @IsIn(["DIKIRIM", "DITERIMA", "DIBATALKAN"])
  status: "DIKIRIM" | "DITERIMA" | "DIBATALKAN";

  @IsOptional() @IsString() @MinLength(3)
  reason?: string;
}

export class DeliveryReportDto {
  @IsString() @MinLength(3)
  reportText: string;

  @IsOptional() @Type(() => Number) @IsInt()
  reportFileId?: number;
}
