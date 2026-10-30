import { Transform, Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
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
  @IsOptional() @Type(() => Number) @IsInt()
  productId?: number;

  @IsOptional() @IsString()
  customName?: string;

  @IsOptional() @IsString()
  customUnit?: string;

  @IsOptional() @IsBoolean()
  hasSerial?: boolean;

  @IsInt() @Min(1)
  qty!: number;

  @IsOptional() @IsNumber() @Min(0)
  unitCost?: number;

  @IsOptional() @IsString()
  serials?: string;
}

export class RequestDto {
  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === "string") {
      const v = value.trim().toUpperCase().replace(/[\s\-]/g, "_");
      if (v === "PROYEK") return "PROJECT";
      if (v === "STOCK") return "STOK";
      return v;
    }
    return value;
  })
  @IsIn(["PROJECT", "STOK", "INTERNAL", "LAINNYA"])
  costType?: "PROJECT" | "STOK" | "INTERNAL" | "LAINNYA";

  @IsOptional() @IsString()
  procurementSource?: string;

  @IsOptional() @IsString()
  paymentMethod?: string;

  @IsOptional() @IsInt()
  projectId?: number;

  @IsOptional() @IsInt()
  taskId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  supplierId?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === "string") {
      const v = value.trim().toUpperCase().replace(/[\s\-]/g, "_");
      if (v === "NEW") return "BARU";
      if (v === "BEKAS" || v === "SEKOND") return "SECOND";
      return v;
    }
    return value;
  })
  @IsIn(["BARU", "SECOND"])
  condition?: "BARU" | "SECOND";

  @IsOptional() @IsString()
  purpose?: string;

  @IsOptional() @IsString()
  otherNote?: string;

  @IsOptional() @IsInt()
  evidenceFileId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  doFileId?: number;

  @IsOptional()
  @Transform(({ value }) => typeof value === "string" ? value.trim().toUpperCase().replace(/[\s\-]/g, "_") : value)
  @IsIn(["DIAJUKAN", "CEK_STOK", "DISETUJUI", "DIBAYAR", "DITOLAK", "PO_DIBUAT", "DIKIRIM", "DITERIMA", "DIBATALKAN"])
  status?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  paymentProofFileId?: number;

  @IsOptional() @IsString()
  paymentStatus?: string;

  @IsOptional() @IsString()
  fundingSource?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true })
  @Type(() => RequestItemDto)
  items?: RequestItemDto[];
}

export class RequestStatusDto {
  @Transform(({ value }) => typeof value === "string" ? value.trim().toUpperCase().replace(/[\s\-]/g, "_") : value)
  @IsIn(["DIAJUKAN", "CEK_STOK", "DISETUJUI", "DIBAYAR", "DITOLAK", "PO_DIBUAT", "DIKIRIM", "DITERIMA", "DIBATALKAN"])
  status!: string;

  @IsOptional() @IsString()
  reason?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  doFileId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  paymentProofFileId?: number;

  @IsOptional() @IsString()
  paymentStatus?: string;

  @IsOptional() @IsString()
  fundingSource?: string;
}

export class PoListQuery extends PageQuery {
  @IsOptional() @IsIn(["MENUNGGU_PERSETUJUAN", "DISETUJUI", "DITOLAK", "DIBATALKAN"])
  status?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === "string") {
      const v = value.toUpperCase().trim().replace(/[\s\-]/g, "_");
      if (v === "BELUM_DIKIRIM" || v === "DI_SUPPLIER" || v === "DISUPPLIER") return "DI_SUPPLIER";
      if (v === "DALAM_PERJALANAN" || v === "KIRIM" || v === "DIKIRIM") return "DIKIRIM";
      if (v === "SAMPAI" || v === "DITERIMA" || v === "SELESAI" || v === "TIBA") return "SAMPAI";
      return v;
    }
    return value;
  })
  @IsIn(["DI_SUPPLIER", "DIKIRIM", "SAMPAI"])
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
  @IsOptional() @Type(() => Number) @IsInt()
  productId?: number;

  @IsOptional() @IsString()
  customName?: string;

  @IsOptional() @IsString()
  customUnit?: string;

  @IsOptional() @IsBoolean()
  hasSerial?: boolean;

  @IsInt() @Min(1)
  qty!: number;

  @IsNumber() @Min(0)
  price!: number;
}

export class PoDto {
  @IsOptional() @IsString()
  number?: string;

  @IsOptional() @IsString()
  supplierSoNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  supplierId?: number;

  @IsOptional() @IsInt()
  requestId?: number;

  @IsOptional() @IsInt()
  projectId?: number;

  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional() @IsDateString()
  eta?: string;

  @IsOptional() @IsString()
  paymentTerms?: string;

  @IsOptional() @IsNumber() @Min(0)
  total?: number;

  @IsOptional() @IsString()
  status?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === "string") {
      const v = value.toUpperCase().trim().replace(/[\s\-]/g, "_");
      if (v === "BELUM_DIKIRIM" || v === "DI_SUPPLIER" || v === "DISUPPLIER") return "DI_SUPPLIER";
      if (v === "DALAM_PERJALANAN" || v === "KIRIM" || v === "DIKIRIM") return "DIKIRIM";
      if (v === "SAMPAI" || v === "DITERIMA" || v === "SELESAI" || v === "TIBA") return "SAMPAI";
      return v;
    }
    return value;
  })
  @IsIn(["DI_SUPPLIER", "DIKIRIM", "SAMPAI"])
  shipmentStatus?: "DI_SUPPLIER" | "DIKIRIM" | "SAMPAI";

  @IsOptional() @IsInt()
  fileId?: number;

  @IsOptional() @IsInt()
  soFileId?: number;

  @IsOptional() @IsInt()
  doFileId?: number;

  @IsOptional() @IsArray() @ValidateNested({ each: true })
  @Type(() => PoItemDto)
  items?: PoItemDto[];
}

export class ShipmentDto {
  @Transform(({ value }) => {
    if (typeof value === "string") {
      const v = value.toUpperCase().trim().replace(/[\s\-]/g, "_");
      if (v === "BELUM_DIKIRIM" || v === "DI_SUPPLIER" || v === "DISUPPLIER") return "DI_SUPPLIER";
      if (v === "DALAM_PERJALANAN" || v === "KIRIM" || v === "DIKIRIM") return "DIKIRIM";
      if (v === "SAMPAI" || v === "DITERIMA" || v === "SELESAI" || v === "TIBA") return "SAMPAI";
      return v;
    }
    return value;
  })
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

  @IsOptional()
  @IsInt()
  @Min(0)
  qtyOrdered?: number;

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

  @IsOptional() @IsInt()
  supplierPoId?: number;

  @IsOptional() @IsInt()
  requestId?: number;

  @IsOptional() @IsString()
  supplierName?: string;

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

  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true })
  @Type(() => ReceivingItemDto)
  items?: ReceivingItemDto[];
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
