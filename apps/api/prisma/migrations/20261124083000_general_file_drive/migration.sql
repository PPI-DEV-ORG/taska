-- CreateTable: General File Management / Company Shared Drive (terpisah dari Dokumen ERP)

CREATE TABLE IF NOT EXISTS `drive_folders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `parentId` INTEGER NULL,
    `name` VARCHAR(180) NOT NULL,
    `description` TEXT NULL,
    `color` VARCHAR(20) NULL,
    `isRestricted` BOOLEAN NOT NULL DEFAULT false,
    `createdById` INTEGER NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `drive_folders_parentId_deletedAt_idx`(`parentId`, `deletedAt`),
    INDEX `drive_folders_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `drive_files` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `folderId` INTEGER NULL,
    `name` VARCHAR(255) NOT NULL,
    `originalName` VARCHAR(255) NOT NULL,
    `extension` VARCHAR(32) NULL,
    `mimeType` VARCHAR(160) NOT NULL,
    `size` INTEGER NOT NULL,
    `storageKey` VARCHAR(700) NOT NULL,
    `providerId` INTEGER NULL,
    `checksumSha256` VARCHAR(64) NULL,
    `description` TEXT NULL,
    `uploadedById` INTEGER NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `drive_files_folderId_deletedAt_idx`(`folderId`, `deletedAt`),
    INDEX `drive_files_name_idx`(`name`),
    INDEX `drive_files_extension_idx`(`extension`),
    INDEX `drive_files_providerId_idx`(`providerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `drive_permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `folderId` INTEGER NULL,
    `fileId` INTEGER NULL,
    `principalType` VARCHAR(16) NOT NULL,
    `principalId` VARCHAR(64) NOT NULL,
    `canView` BOOLEAN NOT NULL DEFAULT true,
    `canUpload` BOOLEAN NOT NULL DEFAULT false,
    `canDownload` BOOLEAN NOT NULL DEFAULT true,
    `canEdit` BOOLEAN NOT NULL DEFAULT false,
    `canDelete` BOOLEAN NOT NULL DEFAULT false,
    `grantedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `drive_permissions_folderId_principalType_principalId_idx`(`folderId`, `principalType`, `principalId`),
    INDEX `drive_permissions_fileId_principalType_principalId_idx`(`fileId`, `principalType`, `principalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `drive_folders`
    ADD CONSTRAINT `drive_folders_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `drive_folders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `drive_folders_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `drive_files`
    ADD CONSTRAINT `drive_files_folderId_fkey` FOREIGN KEY (`folderId`) REFERENCES `drive_folders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `drive_files_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `file_storage_providers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `drive_files_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `drive_permissions`
    ADD CONSTRAINT `drive_permissions_folderId_fkey` FOREIGN KEY (`folderId`) REFERENCES `drive_folders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `drive_permissions_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `drive_files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
