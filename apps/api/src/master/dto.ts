import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsArray,
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

function normalizeActiveStatus(value: unknown) {
  if (typeof value !== "string") return value;
  const v = value.toUpperCase().trim().replace(/[\s\-]/g, "_");
  if (v === "AKTIF" || v === "ACTIVE") return "AKTIF";
  if (v === "NONAKTIF" || v === "NON_AKTIF" || v === "INACTIVE") return "NONAKTIF";
  return v;
}

export class ListQuery extends PageQuery {
  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  categoryId?: number;
}

export class CustomerDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  company?: string;

  @IsOptional() @IsString()
  pic?: string;

  @IsOptional() @IsString()
  email?: string;

  @IsOptional() @IsString()
  phone?: string;

  @IsOptional() @IsString()
  address?: string;

  @IsOptional() @IsString()
  city?: string;

  @IsOptional() @IsString()
  notes?: string;

  @Transform(({ value }) => normalizeActiveStatus(value))
  @IsOptional() @IsIn(["AKTIF", "NONAKTIF"])
  status?: "AKTIF" | "NONAKTIF";
}

export class SupplierTagItemDto {
  @IsString()
  itemName!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;
}

export class SupplierDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  pic?: string;

  @IsOptional() @IsString()
  email?: string;

  @IsOptional() @IsString()
  phone?: string;

  @IsOptional() @IsString()
  city?: string;

  @IsOptional() @IsString()
  paymentTerms?: string;

  @IsOptional() @IsString()
  notes?: string;

  @Transform(({ value }) => normalizeActiveStatus(value))
  @IsOptional() @IsIn(["AKTIF", "NONAKTIF"])
  status?: "AKTIF" | "NONAKTIF";

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === "string") {
      const v = value.toUpperCase().trim().replace(/[\s\-]/g, "_");
      if (v.includes("NON") || v === "NON_PKP") return "NON_PKP";
      if (v.includes("PKP")) return "PKP";
    }
    return value;
  })
  @IsIn(["PKP", "NON_PKP"])
  taxStatus?: "PKP" | "NON_PKP";

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierTagItemDto)
  tags?: SupplierTagItemDto[];
}

export class ProductDto {
  @IsOptional() @IsString()
  sku?: string;

  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  brand?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  type?: string;

  @IsOptional() @IsInt()
  categoryId?: number;

  @IsOptional() @IsString()
  unit?: string;

  @IsOptional() @IsBoolean()
  hasSerial?: boolean;

  @IsOptional() @IsInt() @Min(0)
  minStock?: number;

  @IsOptional() @IsInt() @Min(0)
  warrantyMonths?: number;

  @IsOptional() @IsNumber()
  purchasePrice?: number;

  @Transform(({ value }) => normalizeActiveStatus(value))
  @IsOptional() @IsIn(["AKTIF", "NONAKTIF"])
  status?: "AKTIF" | "NONAKTIF";
}

export class ProductCategoryDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  prefix?: string;

  @Transform(({ value }) => normalizeActiveStatus(value))
  @IsOptional() @IsIn(["AKTIF", "NONAKTIF"])
  status?: "AKTIF" | "NONAKTIF";
}

export class WarehouseDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  city?: string;

  @Transform(({ value }) => normalizeActiveStatus(value))
  @IsOptional() @IsIn(["AKTIF", "NONAKTIF"])
  status?: "AKTIF" | "NONAKTIF";
}

export class NamedDto {
  @IsOptional() @IsString()
  name?: string;

  @Transform(({ value }) => normalizeActiveStatus(value))
  @IsOptional() @IsIn(["AKTIF", "NONAKTIF"])
  status?: "AKTIF" | "NONAKTIF";
}
