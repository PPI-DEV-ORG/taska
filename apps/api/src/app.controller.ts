import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service.js";
import { Public } from "./common/decorators/public.decorator.js";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  root() {
    return this.appService.health();
  }

  @Public()
  @Get("health")
  health() {
    return this.appService.readiness();
  }
}
