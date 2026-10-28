import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { AttendanceService } from "./attendance.service.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CheckInDto, CheckOutDto, RecordAttendanceDto, UpdateAttendanceDto, WorkScheduleSettingsDto } from "./dto.js";

@Controller("hr/attendance")
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get("settings")
  @Require("attendance", "L")
  getSettings() {
    return this.attendance.getSettings();
  }

  @Post("settings")
  @Require("attendance", "U")
  saveSettings(@CurrentUser() user: RequestUser, @Body() dto: WorkScheduleSettingsDto) {
    const role = (user.role || "").toLowerCase();
    if (!["super_admin", "bos", "admin"].includes(role)) {
      throw new BadRequestException("Hanya Super Admin dan Bos yang dapat mengatur jam kerja & aturan lembur");
    }
    return this.attendance.saveSettings(user.id, dto);
  }

  @Patch(":id")
  @Require("attendance", "U")
  updateRecord(
    @CurrentUser() user: RequestUser,
    @Param("id") idStr: string,
    @Body() dto: UpdateAttendanceDto,
  ) {
    const role = (user.role || "").toLowerCase();
    if (!["super_admin", "bos", "admin"].includes(role)) {
      throw new BadRequestException("Hanya Super Admin, Bos, dan Admin yang dapat mengubah data presensi");
    }
    return this.attendance.updateAttendance(parseInt(idStr, 10), dto);
  }

  @Get("today")
  @Require("attendance", "L")
  today(@CurrentUser() user: RequestUser) {
    return this.attendance.getToday(user.id);
  }

  @Post("check-in")
  @Require("attendance", "C")
  checkIn(@CurrentUser() user: RequestUser, @Body() dto: CheckInDto) {
    return this.attendance.checkIn(user.id, dto);
  }

  @Post("check-out")
  @Require("attendance", "C")
  checkOut(@CurrentUser() user: RequestUser, @Body() dto: CheckOutDto) {
    return this.attendance.checkOut(user.id, dto);
  }

  @Post("manual")
  @Require("attendance", "U")
  manual(@Body() dto: RecordAttendanceDto) {
    return this.attendance.recordStatus(dto);
  }

  @Post("record")
  @Require("attendance", "U")
  record(@Body() dto: RecordAttendanceDto) {
    return this.attendance.recordStatus(dto);
  }

  @Get()
  @Require("attendance", "L")
  list(
    @CurrentUser() user: RequestUser,
    @Query("month") month?: string,
    @Query("date") date?: string,
    @Query("userId") userIdStr?: string,
    @Query("page") pageStr?: string,
    @Query("limit") limitStr?: string,
  ) {
    const requestedUserId = userIdStr ? parseInt(userIdStr, 10) : undefined;

    return this.attendance.list({
      month,
      date,
      userId: requestedUserId,
      page: pageStr ? parseInt(pageStr, 10) : undefined,
      limit: limitStr ? parseInt(limitStr, 10) : undefined,
    });
  }

  @Get("summary")
  @Require("attendance", "L")
  summary(
    @CurrentUser() user: RequestUser,
    @Query("month") month?: string,
    @Query("userId") userIdStr?: string,
  ) {
    const requestedUserId = userIdStr ? parseInt(userIdStr, 10) : undefined;

    return this.attendance.summary(month, requestedUserId);
  }
}

