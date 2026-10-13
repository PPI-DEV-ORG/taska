import { Module } from "@nestjs/common";
import { DashboardService } from "./dashboard.service.js";
import { DashboardController } from "./dashboard.controller.js";
import { ApprovalsModule } from "../approvals/approvals.module.js";

@Module({
  imports: [ApprovalsModule],
  providers: [DashboardService],
  controllers: [DashboardController],
  exports: [DashboardService],
})
export class DashboardModule {}
