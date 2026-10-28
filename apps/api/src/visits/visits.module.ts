import { Module } from "@nestjs/common";
import { VisitsService } from "./visits.service.js";
import { VisitsController } from "./visits.controller.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { AuditModule } from "../audit/audit.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule],
  controllers: [VisitsController],
  providers: [VisitsService],
  exports: [VisitsService],
})
export class VisitsModule {}

