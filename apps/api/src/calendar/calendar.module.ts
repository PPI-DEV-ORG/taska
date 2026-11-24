import { Module } from "@nestjs/common";
import { CalendarService } from "./calendar.service.js";
import { CalendarController } from "./calendar.controller.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { AuditModule } from "../audit/audit.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module.js";
import { ContractsModule } from "../contracts/contracts.module.js";
import { MaintenanceModule } from "../maintenance/maintenance.module.js";
import { WhatsappModule } from "../whatsapp/whatsapp.module.js";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    NotificationsModule,
    SubscriptionsModule,
    ContractsModule,
    MaintenanceModule,
    WhatsappModule,
  ],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
