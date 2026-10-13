import { Controller, Get, Post } from "@nestjs/common";
import { WhatsappService } from "./whatsapp.service.js";
import { Require } from "../common/decorators/require-permission.decorator.js";

@Controller("whatsapp")
export class WhatsappController {
  constructor(private readonly service: WhatsappService) {}

  @Get("status")
  @Require("settings", "L")
  getStatus() {
    return this.service.getStatus();
  }

  @Get("qr")
  @Require("settings", "L")
  async getQr() {
    const qr = await this.service.getQrDataUrl();
    return { qr };
  }

  @Post("restart")
  @Require("settings", "U")
  restart() {
    return this.service.restart();
  }

  @Post("logout")
  @Require("settings", "U")
  logout() {
    return this.service.logout();
  }
}

