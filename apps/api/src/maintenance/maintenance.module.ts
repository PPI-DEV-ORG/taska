import { Module } from "@nestjs/common";
import { MaintenanceService } from "./maintenance.service.js";
import { MaintenanceController } from "./maintenance.controller.js";
import { AuditModule } from "../audit/audit.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
