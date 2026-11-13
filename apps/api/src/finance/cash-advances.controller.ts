import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";
import { CashAdvancesService } from "./cash-advances.service.js";
import {
  ApproveCashAdvanceDto,
  CashAdvanceItemDto,
  CashAdvanceListQuery,
  CreateCashAdvanceDto,
  DisburseCashAdvanceDto,
  RejectCashAdvanceDto,
  SettleCashAdvanceDto,
  SubmitReportDto,
  UpdateCashAdvanceDto,
} from "./cash-advances.dto.js";

/**
 * Uang jalan memakai izin modul Pengeluaran:
 *  L/C/U = semua karyawan (ajukan & laporkan miliknya), A = setujui/tolak, P = cairkan & verifikasi laporan.
 */
@Controller("cash-advances")
export class CashAdvancesController {
  constructor(private readonly service: CashAdvancesService) {}

  @Get()
  @Require("expenses", "L")
  list(@Query() q: CashAdvanceListQuery, @CurrentUser() user: RequestUser) {
    return this.service.list(q, user);
  }

  @Get("wallet")
  @Require("expenses", "L")
  wallet(@CurrentUser() user: RequestUser, @Query("employeeId") employeeId?: string) {
    return this.service.wallet(user, employeeId ? Number(employeeId) : undefined);
  }

  @Get(":id")
  @Require("expenses", "L")
  get(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.get(id, user);
  }

  @Post()
  @Require("expenses", "C")
  create(@Body() dto: CreateCashAdvanceDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Patch(":id")
  @Require("expenses", "U")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateCashAdvanceDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user);
  }

  @Post(":id/cancel")
  @Require("expenses", "U")
  cancel(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.cancel(id, user);
  }

  @Post(":id/approve")
  @Require("expenses", "A")
  approve(@Param("id", ParseIntPipe) id: number, @Body() dto: ApproveCashAdvanceDto, @CurrentUser() user: RequestUser) {
    return this.service.approve(id, dto, user);
  }

  @Post(":id/reject")
  @Require("expenses", "A")
  reject(@Param("id", ParseIntPipe) id: number, @Body() dto: RejectCashAdvanceDto, @CurrentUser() user: RequestUser) {
    return this.service.reject(id, dto, user);
  }

  @Post(":id/disburse")
  @Require("expenses", "P")
  disburse(@Param("id", ParseIntPipe) id: number, @Body() dto: DisburseCashAdvanceDto, @CurrentUser() user: RequestUser) {
    return this.service.disburse(id, dto, user);
  }

  @Post(":id/items")
  @Require("expenses", "C")
  addItem(@Param("id", ParseIntPipe) id: number, @Body() dto: CashAdvanceItemDto, @CurrentUser() user: RequestUser) {
    return this.service.addItem(id, dto, user);
  }

  @Delete(":id/items/:itemId")
  @Require("expenses", "C")
  removeItem(
    @Param("id", ParseIntPipe) id: number,
    @Param("itemId", ParseIntPipe) itemId: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.removeItem(id, itemId, user);
  }

  @Post(":id/report")
  @Require("expenses", "C")
  submitReport(@Param("id", ParseIntPipe) id: number, @Body() dto: SubmitReportDto, @CurrentUser() user: RequestUser) {
    return this.service.submitReport(id, dto, user);
  }

  @Post(":id/settle")
  @Require("expenses", "P")
  settle(@Param("id", ParseIntPipe) id: number, @Body() dto: SettleCashAdvanceDto, @CurrentUser() user: RequestUser) {
    return this.service.settle(id, dto, user);
  }
}
