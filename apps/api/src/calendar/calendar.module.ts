import { Module } from "@nestjs/common";
import { CalendarService } from "./calendar.service.js";
import { CalendarController } from "./calendar.controller.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { AuditModule } from "../audit/audit.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}

