import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from "@nestjs/common";
import { PayrollService } from "./payroll.service.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { GeneratePayrollDto, PaySlipDto, UpdateSalaryConfigDto } from "./dto.js";

@Controller("hr/payroll")
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get("configs")
  @Require("payroll", "L")
  getConfigs() {
    return this.payroll.getSalaryConfigs();
  }

  @Put("configs/:userId")
  @Require("payroll", "U")
  updateConfig(
    @Param("userId", ParseIntPipe) userId: number,
    @Body() dto: UpdateSalaryConfigDto,
  ) {
    return this.payroll.updateSalaryConfig(userId, dto);
  }

  @Get("slips")
  @Require("payroll", "L")
  getSlips(
    @CurrentUser() user: RequestUser,
    @Query("period") period?: string,
    @Query("userId") userIdStr?: string,
  ) {
    const isFinanceOrAdmin = ["SUPER_ADMIN", "ADMIN", "BOS", "FINANCE"].includes(user.role?.toUpperCase() || "");
    const requestedUserId = userIdStr ? parseInt(userIdStr, 10) : undefined;
    
    // Karyawan biasa hanya bisa melihat slip gaji miliknya
    const effectiveUserId = isFinanceOrAdmin ? requestedUserId : user.id;

    return this.payroll.getSlips(period, effectiveUserId);
  }

  @Post("generate")
  @Require("payroll", "C")
  generate(@Body() dto: GeneratePayrollDto) {
    return this.payroll.generateSlips(dto);
  }

  @Post("slips/:id/pay")
  @Require("payroll", "U")
  markPaid(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: PaySlipDto,
  ) {
    return this.payroll.markPaid(id, dto);
  }
}

