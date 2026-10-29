import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query } from "@nestjs/common";
import { PayrollService } from "./payroll.service.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { GeneratePayrollDto, PaySlipDto, SaveSalaryConfigDto, UpdateSalaryConfigDto } from "./dto.js";

@Controller("hr/payroll")
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get("configs")
  @Require("payroll", "U")
  getConfigs() {
    return this.payroll.getSalaryConfigs();
  }

  @Get("configs/:userId")
  @Require("payroll", "U")
  getConfigByUserId(@Param("userId", ParseIntPipe) userId: number) {
    return this.payroll.getSalaryConfigByUserId(userId);
  }

  @Post("configs")
  @Require("payroll", "U")
  saveConfig(@Body() dto: SaveSalaryConfigDto) {
    if (!dto.userId) {
      throw new BadRequestException("userId wajib disertakan");
    }
    return this.payroll.updateSalaryConfig(dto.userId, dto);
  }

  @Put("configs/:userId")
  @Require("payroll", "U")
  updateConfig(
    @Param("userId", ParseIntPipe) userId: number,
    @Body() dto: UpdateSalaryConfigDto,
  ) {
    return this.payroll.updateSalaryConfig(userId, dto);
  }

  @Delete("configs/:userId")
  @Require("payroll", "U")
  deleteConfig(@Param("userId", ParseIntPipe) userId: number) {
    return this.payroll.deleteSalaryConfig(userId);
  }

  @Get("slips")
  @Require("payroll", "L")
  getSlips(
    @CurrentUser() user: RequestUser,
    @Query("period") period?: string,
    @Query("userId") userIdStr?: string,
  ) {
    const isFinanceOrAdmin = ["SUPER_ADMIN", "ADMIN", "BOS", "FINANCE", "HR"].includes(user.role?.toUpperCase() || "");
    const requestedUserId = userIdStr ? parseInt(userIdStr, 10) : undefined;
    
    // Karyawan biasa hanya bisa melihat slip gaji miliknya
    const effectiveUserId = isFinanceOrAdmin ? requestedUserId : user.id;

    return this.payroll.getSlips(period, effectiveUserId);
  }

  @Get("slips/:id")
  @Require("payroll", "L")
  getSlipById(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    const isFinanceOrAdmin = ["SUPER_ADMIN", "ADMIN", "BOS", "FINANCE", "HR"].includes(user.role?.toUpperCase() || "");
    return this.payroll.getSlipById(id, isFinanceOrAdmin ? undefined : user.id);
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

  @Delete("slips/:id")
  @Require("payroll", "U")
  deleteSlip(
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.payroll.deleteSlip(id);
  }
}

