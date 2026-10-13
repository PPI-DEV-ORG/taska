import { Module } from "@nestjs/common";
import { ClientPoService } from "./client-po.service.js";
import { ClientPoController } from "./client-po.controller.js";
import { InvoiceOutService } from "./invoice-out.service.js";
import { InvoiceOutController } from "./invoice-out.controller.js";
import { InvoiceInService } from "./invoice-in.service.js";
import { InvoiceInController } from "./invoice-in.controller.js";
import { ExpensesService } from "./expenses.service.js";
import { ExpensesController } from "./expenses.controller.js";
import { ApprovalsModule } from "../approvals/approvals.module.js";

@Module({
  imports: [ApprovalsModule],
  providers: [ClientPoService, InvoiceOutService, InvoiceInService, ExpensesService],
  controllers: [ClientPoController, InvoiceOutController, InvoiceInController, ExpensesController],
  exports: [InvoiceOutService, ExpensesService],
})
export class FinanceModule {}
