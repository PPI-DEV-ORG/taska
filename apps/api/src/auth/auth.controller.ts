import { Body, Controller, Get, HttpCode, Ip, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service.js";
import { LoginDto, RefreshDto } from "./dto/auth.dto.js";
import { Public } from "../common/decorators/public.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Ip() ip: string, @Req() req: Request) {
    return this.auth.login(dto.email, dto.password, { ip, userAgent: req.get("user-agent") });
  }

  @Public()
  @Post("refresh")
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto, @Ip() ip: string, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, { ip, userAgent: req.get("user-agent") });
  }

  @Post("logout")
  @HttpCode(200)
  logout(@Body() dto: RefreshDto, @Ip() ip: string, @Req() req: Request) {
    return this.auth.logout(dto.refreshToken, { ip, userAgent: req.get("user-agent") });
  }

  @Get("me")
  me(@CurrentUser() user: RequestUser) {
    if (!user) throw new UnauthorizedException();
    return this.auth.me(user);
  }
}
