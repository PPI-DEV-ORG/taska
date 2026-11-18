import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module.js";
import { FixedAssetsController } from "./fixed-assets.controller.js";
import { FixedAssetsService } from "./fixed-assets.service.js";

@Module({
  imports: [PrismaModule],
  controllers: [FixedAssetsController],
  providers: [FixedAssetsService],
  exports: [FixedAssetsService],
})
export class FixedAssetsModule {}
