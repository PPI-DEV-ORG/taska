import { Module } from "@nestjs/common";
import { DocumentationService } from "./documentation.service.js";
import { DocumentationController } from "./documentation.controller.js";
import { UploadModule } from "../upload/upload.module.js";

@Module({
  imports: [UploadModule],
  providers: [DocumentationService],
  controllers: [DocumentationController],
})
export class DocumentationModule {}
