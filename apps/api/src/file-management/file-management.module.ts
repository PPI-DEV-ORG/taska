import { Global, Module } from "@nestjs/common";
import { FileCryptoService } from "./crypto.service.js";
import { FileProviderService } from "./provider.service.js";
import { FileAccessService } from "./file-access.service.js";
import { FileMigrationService } from "./migration.service.js";
import { FileSchedulerService } from "./scheduler.service.js";
import { FileManagementService } from "./file-management.service.js";
import { FileManagementController, FileShareController } from "./file-management.controller.js";

@Global()
@Module({
  controllers: [FileManagementController, FileShareController],
  providers: [
    FileCryptoService,
    FileProviderService,
    FileAccessService,
    FileMigrationService,
    FileSchedulerService,
    FileManagementService,
  ],
  exports: [
    FileCryptoService,
    FileProviderService,
    FileAccessService,
    FileMigrationService,
    FileSchedulerService,
    FileManagementService,
  ],
})
export class FileManagementModule {}
