import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { CalendarService } from "./calendar.service.js";
import { CalendarEventDto, CalendarQuery, CalendarStatusDto } from "./dto.js";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";

// Kalender terbuka untuk semua user login; pembatasan data per user dilakukan di service.
@Controller("calendar")
export class CalendarController {
  constructor(private readonly service: CalendarService) {}

  @Get("events")
  list(@Query() q: CalendarQuery, @CurrentUser() user: RequestUser) {
    return this.service.list(q, user);
  }

  @Get("events/:id")
  get(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.get(id, user);
  }

  @Post("events")
  create(@Body() dto: CalendarEventDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Patch("events/:id")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: CalendarEventDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user);
  }

  @Post("events/:id/status")
  @Patch("events/:id/status")
  status(@Param("id", ParseIntPipe) id: number, @Body() dto: CalendarStatusDto, @CurrentUser() user: RequestUser) {
    return this.service.updateStatus(id, dto, user);
  }

  @Delete("events/:id")
  remove(
    @Param("id", ParseIntPipe) id: number,
    @Query("occurrenceDate") occurrenceDate: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.remove(id, user, occurrenceDate);
  }
}
