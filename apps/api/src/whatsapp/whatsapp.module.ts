import { Module } from "@nestjs/common";
import { WhatsappService } from "./whatsapp.service.js";
import { WhatsappController } from "./whatsapp.controller.js";
import { WhatsappConversationService } from "./whatsapp-conversation.service.js";
import { WhatsappReportService } from "./whatsapp-report.service.js";
import { DocumentationModule } from "../documentation/documentation.module.js";
import { UploadModule } from "../upload/upload.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";

@Module({
  imports: [PrismaModule, UploadModule, DocumentationModule],
  controllers: [WhatsappController],
  providers: [
    WhatsappService,
    WhatsappConversationService,
    WhatsappReportService,
  ],
  exports: [WhatsappService],
})
export class WhatsappModule {}

