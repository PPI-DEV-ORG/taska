import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { PageQuery } from "../common/dto/page-query.js";

export class RequestListQuery extends PageQuery {
  @IsOptional() @IsIn(["DIAJUKAN", "CEK_STOK", "DISETUJUI", "DITOLAK", "PO_DIBUAT", "DIKIRIM", "DITERIMA", "DIBATALKAN"])
  status?: string;

  @IsOptional() @IsIn(["PROJECT", "STOK", "INTERNAL", "LAINNYA"])
  costType?: "PROJECT" | "STOK" | "INTERNAL" | "LAINNYA";

  @IsOptional() @Type(() => Number) @IsInt()
  projectId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  requesterId?: number;

  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;
}

export class RequestItemDto {
  @IsInt()
  productId!: number;

  @IsInt() @Min(1)
  qty!: number;

  @IsOptional() @IsNumber() @Min(0)
  unitCost?: number;
}

export class RequestDto {
  @IsOptional() @IsDateString()
  date?: string;

  @IsIn(["PROJECT", "STOK", "INTERNAL", "LAINNYA"])
  costType!: "PROJECT" | "STOK" | "INTERNAL" | "LAINNYA";

  @IsOptional() @IsInt()
  projectId?: number;

  @IsOptional() @IsInt()
  taskId?: number;

  @IsOptional() @IsInt()
  supplierId?: number;

  @IsOptional() @IsIn(["BARU", "SECOND"])
  condition?: "BARU" | "SECOND";

  @IsString() @MinLength(1)
  purpose!: string;

  @IsOptional() @IsString()
  otherNote?: string;

  @IsOptional() @IsInt()
  evidenceFileId?: number;

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true })
  @Type(() => RequestItemDto)
  items!: RequestItemDto[];
}

export class RequestStatusDto {
  @IsIn(["DIAJUKAN", "CEK_STOK", "DISETUJUI", "DITOLAK", "PO_DIBUAT", "DIKIRIM", "DITERIMA", "DIBATALKAN"])
  status!: string;

  @IsOptional() @IsString()
  reason?: string;
}

export class PoListQuery extends PageQuery {
  @IsOptional() @IsIn(["MENUNGGU_PERSETUJUAN", "DISETUJUI", "DITOLAK", "DIBATALKAN"])
  status?: string;

  @IsOptional() @IsIn(["DI_SUPPLIER", "DIKIRIM", "SAMPAI"])
  shipmentStatus?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  supplierId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  requestId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  projectId?: number;

  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;
}

export class PoItemDto {
  @IsInt()
  productId!: number;

  @IsInt() @Min(1)
  qty!: number;

  @IsNumber() @Min(0)
  price!: number;
}

export class PoDto {
  @IsOptional() @IsString()
  number?: string;

  @IsInt()
  supplierId!: number;

  @IsOptional() @IsInt()
  requestId?: number;

  @IsOptional() @IsInt()
  projectId?: number;

  @IsDateString()
  date!: string;

  @IsOptional() @IsDateString()
  eta?: string;

  @IsOptional() @IsString()
  paymentTerms?: string;

  @IsInt()
  fileId!: number;

  @IsOptional() @IsInt()
  doFileId?: number;

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true })
  @Type(() => PoItemDto)
  items!: PoItemDto[];
}

export class ShipmentDto {
  @IsIn(["DI_SUPPLIER", "DIKIRIM", "SAMPAI"])
  shipmentStatus!: "DI_SUPPLIER" | "DIKIRIM" | "SAMPAI";

  @IsOptional() @IsInt()
  doFileId?: number;
}

export class ReceivingListQuery extends PageQuery {
  @IsOptional() @IsIn(["MENUNGGU", "DITERIMA_SEBAGIAN", "DITERIMA", "DITOLAK"])
  status?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  supplierPoId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  warehouseId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  projectId?: number;
}

export class ReceivingItemDto {
  @IsInt()
  productId!: number;

  @IsInt() @Min(0)
  qtyReceived!: number;

  @IsOptional() @IsString()
  serials?: string;

  @IsOptional() @IsString()
  note?: string;
}

export class ReceivingDto {
  @IsOptional() @IsString()
  number?: string;

  @IsInt()
  supplierPoId!: number;

  @IsOptional() @IsInt()
  warehouseId?: number;

  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional() @IsString()
  conditionNote?: string;

  @IsOptional() @IsInt()
  receiptFileId?: number;

  @IsOptional() @IsInt()
  photoFileId?: number;

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true })
  @Type(() => ReceivingItemDto)
  items!: ReceivingItemDto[];
}

export class IssueDto {
  @IsIn(["RUSAK", "SALAH_BARANG", "KURANG"])
  type!: "RUSAK" | "SALAH_BARANG" | "KURANG";

  @IsOptional() @IsInt() @Min(1)
  qty?: number;

  @IsString() @MinLength(1)
  description!: string;

  @IsOptional() @IsInt()
  productId?: number;

  @IsOptional() @IsInt()
  fileId?: number;

  @IsOptional() @IsInt()
  receivingId?: number;
}
