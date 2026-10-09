import { Module } from "@nestjs/common";
import { ReportsService } from "./reports.service.js";
import { ReportsController } from "./reports.controller.js";
import { ApprovalsModule } from "../approvals/approvals.module.js";
import { StockModule } from "../stock/stock.module.js";

@Module({
  imports: [ApprovalsModule, StockModule],
  providers: [ReportsService],
  controllers: [ReportsController],
  exports: [ReportsService],
})
export class ReportsModule {}
