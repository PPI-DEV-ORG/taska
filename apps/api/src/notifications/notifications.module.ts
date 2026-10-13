import { Global, Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service.js";
import { NotificationsGateway } from "./notifications.gateway.js";
import { NotificationsController } from "./notifications.controller.js";
import { AuthModule } from "../auth/auth.module.js";

@Global()
@Module({
  imports: [AuthModule],
  providers: [NotificationsService, NotificationsGateway],
  controllers: [NotificationsController],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
