import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";
import { PageQuery } from "../common/dto/page-query.js";

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

  @IsOptional() @IsIn(["AKTIF", "NONAKTIF"])
  status?: "AKTIF" | "NONAKTIF";
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

  @IsOptional() @IsIn(["AKTIF", "NONAKTIF"])
  status?: "AKTIF" | "NONAKTIF";
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

  @IsOptional() @IsIn(["AKTIF", "NONAKTIF"])
  status?: "AKTIF" | "NONAKTIF";
}

export class WarehouseDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  city?: string;

  @IsOptional() @IsIn(["AKTIF", "NONAKTIF"])
  status?: "AKTIF" | "NONAKTIF";
}

export class NamedDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsIn(["AKTIF", "NONAKTIF"])
  status?: "AKTIF" | "NONAKTIF";
}
