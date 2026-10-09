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

export class MovementListQuery extends PageQuery {
  @IsOptional() @Type(() => Number) @IsInt()
  productId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  warehouseId?: number;

  @IsOptional() @IsIn(["IN", "OUT", "TRANSFER"])
  type?: "IN" | "OUT" | "TRANSFER";

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  projectId?: number;

  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;
}

export class SummaryQuery extends PageQuery {
  @IsOptional() @Type(() => Number) @IsInt()
  warehouseId?: number;

  @IsOptional() @IsIn(["true", "false"])
  lowOnly?: "true" | "false";
}

export class TransferDto {
  @Type(() => Number) @IsInt()
  productId: number;

  @Type(() => Number) @IsInt()
  fromWarehouseId: number;

  @Type(() => Number) @IsInt()
  toWarehouseId: number;

  @Type(() => Number) @IsInt() @Min(1)
  qty: number;

  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  serials?: string[];

  @IsOptional() @IsString() @MinLength(3)
  reason?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  deliveryNoteId?: number;
}

export class SerialListQuery extends PageQuery {
  @IsOptional() @IsString()
  sn?: string;

  @IsOptional() @IsIn(["DI_GUDANG", "RESERVED", "DIKIRIM", "TERPASANG", "RETUR", "DIGANTI", "RUSAK"])
  status?: "DI_GUDANG" | "RESERVED" | "DIKIRIM" | "TERPASANG" | "RETUR" | "DIGANTI" | "RUSAK";

  @IsOptional() @Type(() => Number) @IsInt()
  productId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  warehouseId?: number;
}

export class SerialStatusDto {
  @IsIn(["DI_GUDANG", "RESERVED", "DIKIRIM", "TERPASANG", "RETUR", "RUSAK"])
  status: "DI_GUDANG" | "RESERVED" | "DIKIRIM" | "TERPASANG" | "RETUR" | "RUSAK";

  @IsOptional() @IsString() @MinLength(3)
  note?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  warehouseId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  projectId?: number;
}

export class ReplaceSerialDto {
  @IsString() @MinLength(1)
  newSn: string;

  @IsString() @MinLength(3)
  reason: string;

  @IsOptional() @IsDateString()
  warrantyEndsAt?: string;
}

export class OpnameDetailDto {
  @Type(() => Number) @IsInt()
  productId: number;

  @Type(() => Number) @IsInt() @Min(0)
  countedQty: number;

  @IsOptional() @IsString()
  note?: string;
}

export class OpnameCreateDto {
  @Type(() => Number) @IsInt()
  warehouseId: number;

  @IsDateString()
  date: string;

  @IsOptional() @Type(() => Number) @IsInt()
  conductorId?: number;

  @IsOptional() @IsString() @MinLength(3)
  reason?: string;

  @IsArray() @ValidateNested({ each: true }) @Type(() => OpnameDetailDto)
  details: OpnameDetailDto[];
}

export class OpnameSubmitDto {
  @IsOptional() @IsString() @MinLength(3)
  reason?: string;
}

export class ReservationListQuery extends PageQuery {
  @IsOptional() @Type(() => Number) @IsInt()
  projectId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  productId?: number;

  @IsOptional() @IsIn(["true", "false"])
  released?: "true" | "false";
}

export class ReservationCreateDto {
  @Type(() => Number) @IsInt()
  projectId: number;

  @IsOptional() @Type(() => Number) @IsInt()
  productId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  serialUnitId?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  qty?: number;
}

export class DamageCreateDto {
  @IsOptional() @IsDateString()
  date?: string;

  @Type(() => Number) @IsInt()
  productId: number;

  @IsOptional() @Type(() => Number) @IsInt()
  serialUnitId?: number;

  @IsIn(["RUSAK", "SALAH_BARANG", "KURANG"])
  type: "RUSAK" | "SALAH_BARANG" | "KURANG";

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  qty?: number;

  @IsString() @MinLength(3)
  description: string;

  @IsOptional() @Type(() => Number) @IsInt()
  fileId?: number;
}

export class DamageListQuery extends PageQuery {
  @IsOptional() @IsIn(["DILAPORKAN", "DIPROSES", "SELESAI"])
  status?: "DILAPORKAN" | "DIPROSES" | "SELESAI";

  @IsOptional() @Type(() => Number) @IsInt()
  productId?: number;
}

export class DamageStatusDto {
  @IsIn(["DILAPORKAN", "DIPROSES", "SELESAI"])
  status: "DILAPORKAN" | "DIPROSES" | "SELESAI";
}
