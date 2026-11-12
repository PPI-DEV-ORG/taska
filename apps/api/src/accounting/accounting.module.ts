import { Module, Global } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module.js";
import { DocumentNumberModule } from "../document-number/document-number.module.js";
import { AccountsService } from "./accounts.service.js";
import { MappingService } from "./mapping.service.js";
import { PeriodService } from "./period.service.js";
import { PostingService } from "./posting.service.js";
import { AccountingReportService } from "./accounting-report.service.js";
import { TaxService } from "./tax.service.js";
import { AccountingController } from "./accounting.controller.js";

@Global()
@Module({
  imports: [PrismaModule, DocumentNumberModule],
  controllers: [AccountingController],
  providers: [
    AccountsService,
    MappingService,
    PeriodService,
    PostingService,
    AccountingReportService,
    TaxService,
  ],
  exports: [
    AccountsService,
    MappingService,
    PeriodService,
    PostingService,
    AccountingReportService,
    TaxService,
  ],
})
export class AccountingModule {}
