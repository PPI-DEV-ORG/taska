import { Module } from "@nestjs/common";
import { ImportsService } from "./imports.service.js";
import { ImportsController } from "./imports.controller.js";

@Module({
  providers: [ImportsService],
  controllers: [ImportsController],
})
export class ImportsModule {}
