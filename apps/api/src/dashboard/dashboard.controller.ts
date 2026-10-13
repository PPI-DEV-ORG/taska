import { Controller, Get } from "@nestjs/common";
import { DashboardService } from "./dashboard.service.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  @Require("dashboard", "L")
  summary(@CurrentUser() user: RequestUser) {
    return this.service.summary(user);
  }
}
