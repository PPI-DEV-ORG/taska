import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import { IsString, MinLength } from "class-validator";
import { SettingsService } from "./settings.service.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

class SetValueDto {
  @IsString()
  @MinLength(1)
  value!: string;
}

@Controller("settings")
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @Require("settings", "L")
  list() {
    return this.settings.list();
  }

  @Put(":key")
  @Require("settings", "U")
  set(@Param("key") key: string, @Body() dto: SetValueDto, @CurrentUser() user: RequestUser) {
    return this.settings.set(key, dto.value, user);
  }
}
