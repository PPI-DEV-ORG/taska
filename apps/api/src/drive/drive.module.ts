import { Module } from "@nestjs/common";
import { DriveAccessService } from "./drive-access.service.js";
import { DriveService } from "./drive.service.js";
import { DriveController } from "./drive.controller.js";

@Module({
  controllers: [DriveController],
  providers: [DriveAccessService, DriveService],
  exports: [DriveAccessService, DriveService],
})
export class DriveModule {}
