import { Module } from "@nestjs/common";
import { PocController } from "./poc.controller.js";
import { PocService } from "./poc.service.js";

@Module({
  controllers: [PocController],
  providers: [PocService],
  exports: [PocService],
})
export class PocModule {}

