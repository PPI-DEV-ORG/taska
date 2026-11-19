import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module.js";
import { AuditModule } from "../audit/audit.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { ContractsController } from "./contracts.controller.js";
import { ContractsService } from "./contracts.service.js";

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
