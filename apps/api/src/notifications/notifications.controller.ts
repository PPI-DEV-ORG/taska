import { Body, Controller, Get, HttpCode, Post, Query } from "@nestjs/common";
import { IsArray, IsInt, IsOptional } from "class-validator";
import { Type } from "class-transformer";
import { NotificationsService } from "./notifications.service.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

class ReadDto {
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  ids?: number[];
}

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("unread") unread?: string,
  ) {
    return this.notifications.list(user.id, {
      page: Number(page ?? 1) || 1,
      limit: Math.min(Number(limit ?? 20) || 20, 100),
      unread: unread === "true",
    });
  }

  @Get("unread-count")
  unread(@CurrentUser() user: RequestUser) {
    return this.notifications.unreadCount(user.id);
  }

  @Post("read")
  @HttpCode(200)
  read(@CurrentUser() user: RequestUser, @Body() dto: ReadDto) {
    return this.notifications.markRead(user.id, dto.ids);
  }

  @Post("read-all")
  @HttpCode(200)
  readAll(@CurrentUser() user: RequestUser) {
    return this.notifications.markRead(user.id);
  }
}
