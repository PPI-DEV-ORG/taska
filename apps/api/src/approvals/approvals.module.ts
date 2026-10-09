import { Module } from "@nestjs/common";
import { ApprovalsService } from "./approvals.service.js";
import { ApprovalsController } from "./approvals.controller.js";
import { NotificationsModule } from "../notifications/notifications.module.js";

@Module({
  imports: [NotificationsModule],
  providers: [ApprovalsService],
  controllers: [ApprovalsController],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
