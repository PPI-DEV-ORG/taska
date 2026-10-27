import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module.js";
import { AttendanceController } from "./attendance.controller.js";
import { AttendanceService } from "./attendance.service.js";
import { PayrollController } from "./payroll.controller.js";
import { PayrollService } from "./payroll.service.js";

@Module({
  imports: [PrismaModule],
  controllers: [AttendanceController, PayrollController],
  providers: [AttendanceService, PayrollService],
  exports: [AttendanceService, PayrollService],
})
export class HrModule {}

