import { Module } from "@nestjs/common";
import { UploadService } from "./upload.service.js";
import { UploadController } from "./upload.controller.js";

@Module({
  providers: [UploadService],
  controllers: [UploadController],
  exports: [UploadService],
})
export class UploadModule {}
