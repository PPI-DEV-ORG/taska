import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";
import { PageQuery } from "../common/dto/page-query.js";

export class FinanceListQuery extends PageQuery {
  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  customerId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  supplierId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  projectId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  clientPoId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  reporterId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  surveyId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  deliveryNoteId?: number;

  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;
}

export class ClientPoDto {
  @IsOptional() @IsString()
  number?: string;

  @IsOptional() @IsInt()
  customerId?: number;

  @IsOptional() @IsInt()
  quotationId?: number;

  @IsOptional() @IsNumber() @Min(0)
  amount?: number;

  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional() @IsInt()
  fileId?: number;

  @IsOptional() @IsString()
  notes?: string;
}

export class InvoiceOutDto {
  @IsOptional() @IsString()
  number?: string;

  @IsOptional() @IsInt()
  clientPoId?: number;

  @IsOptional() @IsInt()
  quotationId?: number;

  @IsOptional() @IsString()
  quotation?: string;

  @IsOptional() @IsInt()
  projectId?: number;

  @IsOptional() @IsInt()
  customerId?: number;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsIn(["DP", "TERMIN", "PELUNASAN"])
  type?: "DP" | "TERMIN" | "PELUNASAN";

  @IsOptional() @IsNumber() @Min(0)
  amount?: number;

  @IsOptional() @IsNumber() @Min(0)
  discount?: number;

  @IsOptional() @IsNumber() @Min(0)
  ppn?: number;

  @IsOptional() @IsNumber() @Min(0)
  total?: number;

  @IsOptional() @IsNumber() @Min(0)
  paidAmount?: number;

  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional() @IsDateString()
  dueDate?: string;

  @IsOptional() @IsIn(["DRAFT", "SENT", "PARTIAL", "PAID", "OVERDUE", "BATAL"])
  status?: "DRAFT" | "SENT" | "PARTIAL" | "PAID" | "OVERDUE" | "BATAL";

  @IsOptional() @IsInt()
  fileId?: number;

  @IsOptional()
  items?: any[];

  @IsOptional() @IsString()
  subject?: string;

  @IsOptional() @IsString()
  intro?: string;

  @IsOptional()
  notesList?: string[];

  @IsOptional() @IsString()
  city?: string;

  @IsOptional() @IsString()
  kopText?: string;

  @IsOptional() @IsString()
  kopLogoUrl?: string;

  @IsOptional() @IsString()
  customerAddress?: string;

  @IsOptional() @IsString()
  signerName?: string;

  @IsOptional() @IsString()
  signerTitle?: string;

  @IsOptional() @IsString()
  dpLabel?: string;

  @IsOptional() @IsNumber()
  dpAmount?: number;
}

export class InvoiceInDto {
  @IsOptional() @IsString()
  number?: string;

  @IsInt()
  supplierId!: number;

  @IsOptional() @IsInt()
  supplierPoId?: number;

  @IsNumber() @Min(0)
  amount!: number;

  @IsOptional() @IsNumber() @Min(0)
  ppn?: number;

  @IsNumber() @Min(0)
  total!: number;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  date?: string;

  @IsOptional()
  data?: any;

  @IsOptional() @IsInt()
  fileId?: number;

  @IsOptional() @IsInt()
  transferFileId?: number;
}

export class PaymentDto {
  @IsNumber() @Min(1)
  amount!: number;

  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional() @IsIn(["TRANSFER", "TUNAI", "QRIS", "LAINNYA"])
  method?: "TRANSFER" | "TUNAI" | "QRIS" | "LAINNYA";

  @IsOptional() @IsString()
  reference?: string;

  @IsOptional() @IsInt()
  fileId?: number;
}

export class ExpenseDto {
  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional() @IsInt()
  categoryId?: number;

  @IsOptional() @IsNumber() @Min(0)
  amount?: number;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsInt()
  projectId?: number;

  @IsOptional() @IsInt()
  surveyId?: number;

  @IsOptional() @IsInt()
  deliveryNoteId?: number;

  @IsOptional() @IsInt()
  costCenterId?: number;

  @IsOptional() @IsInt()
  receiptFileId?: number;

  @IsOptional() @IsInt()
  paidFileId?: number;

  @IsOptional() @IsIn(["DILAPORKAN", "DISETUJUI", "DITOLAK", "DIBAYAR"])
  status?: "DILAPORKAN" | "DISETUJUI" | "DITOLAK" | "DIBAYAR";
}

export class ExpenseStatusDto {
  @IsIn(["DILAPORKAN", "DISETUJUI", "DITOLAK", "DIBAYAR"])
  status!: "DILAPORKAN" | "DISETUJUI" | "DITOLAK" | "DIBAYAR";

  @IsOptional() @IsString()
  reason?: string;

  @IsOptional() @IsInt()
  paidFileId?: number;
}
