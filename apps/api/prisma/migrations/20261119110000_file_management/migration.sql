-- File Management (PRD: Core Document & Storage Service)
-- Aman untuk data lama: kolom baru punya default, file lama otomatis mendapat versi 1 + lokasi di "Server Lokal".

-- AlterTable File
ALTER TABLE `File`
    ADD COLUMN `fileCode` VARCHAR(40) NULL,
    ADD COLUMN `displayName` VARCHAR(255) NULL,
    ADD COLUMN `extension` VARCHAR(20) NULL,
    ADD COLUMN `checksumSha256` VARCHAR(64) NULL,
    ADD COLUMN `status` VARCHAR(24) NOT NULL DEFAULT 'AVAILABLE',
    ADD COLUMN `visibility` VARCHAR(24) NOT NULL DEFAULT 'COMPANY',
    ADD COLUMN `categoryId` INTEGER NULL,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `currentVersionId` INTEGER NULL,
    ADD COLUMN `idempotencyKey` VARCHAR(100) NULL,
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateTable file_categories
CREATE TABLE `file_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(60) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `allowedExtensions` JSON NULL,
    `maxFileSize` INTEGER NULL,
    `isConfidential` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `file_categories_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable file_versions
CREATE TABLE `file_versions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fileId` INTEGER NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `mimeType` VARCHAR(120) NOT NULL,
    `checksumSha256` VARCHAR(64) NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `changeNotes` TEXT NULL,
    `status` VARCHAR(24) NOT NULL DEFAULT 'CURRENT',

    INDEX `file_versions_fileId_idx`(`fileId`),
    UNIQUE INDEX `file_versions_fileId_versionNumber_key`(`fileId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable file_storage_providers
CREATE TABLE `file_storage_providers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `type` VARCHAR(24) NOT NULL,
    `adapterCode` VARCHAR(40) NOT NULL,
    `config` JSON NOT NULL,
    `secretEnc` TEXT NULL,
    `source` VARCHAR(8) NOT NULL DEFAULT 'DB',
    `status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `needsReauth` BOOLEAN NOT NULL DEFAULT false,
    `lastOkAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `uploadOk` INTEGER NOT NULL DEFAULT 0,
    `uploadFail` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `file_storage_providers_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable file_storage_locations
CREATE TABLE `file_storage_locations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fileId` INTEGER NOT NULL,
    `versionId` INTEGER NOT NULL,
    `providerId` INTEGER NOT NULL,
    `storageKey` VARCHAR(700) NOT NULL,
    `externalFileId` VARCHAR(255) NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `replicaStatus` VARCHAR(20) NOT NULL DEFAULT 'PRIMARY',
    `verificationStatus` VARCHAR(20) NOT NULL DEFAULT 'VERIFIED',
    `lastVerifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `file_storage_locations_fileId_idx`(`fileId`),
    INDEX `file_storage_locations_versionId_idx`(`versionId`),
    INDEX `file_storage_locations_providerId_replicaStatus_idx`(`providerId`, `replicaStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable file_relations
CREATE TABLE `file_relations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fileId` INTEGER NOT NULL,
    `moduleCode` VARCHAR(40) NOT NULL,
    `entityType` VARCHAR(60) NOT NULL,
    `entityId` VARCHAR(100) NOT NULL,
    `relationType` VARCHAR(40) NOT NULL DEFAULT 'ATTACHMENT',
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `file_relations_moduleCode_entityType_entityId_idx`(`moduleCode`, `entityType`, `entityId`),
    UNIQUE INDEX `file_relations_fileId_moduleCode_entityType_entityId_relatio_key`(`fileId`, `moduleCode`, `entityType`, `entityId`, `relationType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable file_folders
CREATE TABLE `file_folders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `parentId` INTEGER NULL,
    `name` VARCHAR(160) NOT NULL,
    `ownerId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `file_folders_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable file_folder_relations
CREATE TABLE `file_folder_relations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `folderId` INTEGER NOT NULL,
    `fileId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `file_folder_relations_fileId_key`(`fileId`),
    INDEX `file_folder_relations_folderId_idx`(`folderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable file_tags
CREATE TABLE `file_tags` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `file_tags_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable file_tag_relations
CREATE TABLE `file_tag_relations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fileId` INTEGER NOT NULL,
    `tagId` INTEGER NOT NULL,

    INDEX `file_tag_relations_tagId_idx`(`tagId`),
    UNIQUE INDEX `file_tag_relations_fileId_tagId_key`(`fileId`, `tagId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable file_permissions
CREATE TABLE `file_permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fileId` INTEGER NOT NULL,
    `principalType` VARCHAR(16) NOT NULL,
    `principalId` VARCHAR(64) NOT NULL,
    `permission` VARCHAR(16) NOT NULL,
    `grantedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `file_permissions_principalType_principalId_idx`(`principalType`, `principalId`),
    UNIQUE INDEX `file_permissions_fileId_principalType_principalId_permission_key`(`fileId`, `principalType`, `principalId`, `permission`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable file_shares
CREATE TABLE `file_shares` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fileId` INTEGER NOT NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `permission` VARCHAR(16) NOT NULL DEFAULT 'VIEW',
    `expiresAt` DATETIME(3) NOT NULL,
    `passwordHash` VARCHAR(100) NULL,
    `oneTime` BOOLEAN NOT NULL DEFAULT false,
    `usedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `file_shares_tokenHash_key`(`tokenHash`),
    INDEX `file_shares_fileId_idx`(`fileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable file_share_access_logs
CREATE TABLE `file_share_access_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shareId` INTEGER NOT NULL,
    `ip` VARCHAR(64) NULL,
    `userAgent` TEXT NULL,
    `success` BOOLEAN NOT NULL,
    `reason` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `file_share_access_logs_shareId_idx`(`shareId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable file_audit_logs
CREATE TABLE `file_audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fileId` INTEGER NULL,
    `versionId` INTEGER NULL,
    `userId` INTEGER NULL,
    `action` VARCHAR(40) NOT NULL,
    `ip` VARCHAR(64) NULL,
    `userAgent` TEXT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `file_audit_logs_fileId_idx`(`fileId`),
    INDEX `file_audit_logs_action_createdAt_idx`(`action`, `createdAt`),
    INDEX `file_audit_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable file_migration_jobs
CREATE TABLE `file_migration_jobs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sourceProviderId` INTEGER NOT NULL,
    `targetProviderId` INTEGER NOT NULL,
    `mode` VARCHAR(12) NOT NULL DEFAULT 'MANUAL',
    `scheduleId` INTEGER NULL,
    `olderThanDays` INTEGER NULL,
    `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    `totalFiles` INTEGER NOT NULL DEFAULT 0,
    `processedFiles` INTEGER NOT NULL DEFAULT 0,
    `failedFiles` INTEGER NOT NULL DEFAULT 0,
    `cleanedFiles` INTEGER NOT NULL DEFAULT 0,
    `error` TEXT NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `file_migration_jobs_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable file_migration_items
CREATE TABLE `file_migration_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `jobId` INTEGER NOT NULL,
    `fileId` INTEGER NOT NULL,
    `versionId` INTEGER NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `error` TEXT NULL,
    `checksum` VARCHAR(64) NULL,
    `sourceLocationId` INTEGER NULL,
    `targetLocationId` INTEGER NULL,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `file_migration_items_jobId_status_idx`(`jobId`, `status`),
    UNIQUE INDEX `file_migration_items_jobId_fileId_versionId_key`(`jobId`, `fileId`, `versionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable file_migration_schedules
CREATE TABLE `file_migration_schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NULL,
    `sourceProviderId` INTEGER NOT NULL,
    `targetProviderId` INTEGER NOT NULL,
    `everyDays` INTEGER NOT NULL,
    `runAtTime` VARCHAR(5) NOT NULL DEFAULT '02:00',
    `olderThanDays` INTEGER NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `lastRunAt` DATETIME(3) NULL,
    `nextRunAt` DATETIME(3) NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `file_migration_schedules_enabled_nextRunAt_idx`(`enabled`, `nextRunAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Indexes & unique on File
CREATE UNIQUE INDEX `File_fileCode_key` ON `File`(`fileCode`);
CREATE UNIQUE INDEX `File_uploadedById_idempotencyKey_key` ON `File`(`uploadedById`, `idempotencyKey`);
CREATE INDEX `File_status_idx` ON `File`(`status`);
CREATE INDEX `File_categoryId_idx` ON `File`(`categoryId`);
CREATE INDEX `File_createdAt_idx` ON `File`(`createdAt`);

-- Foreign keys
ALTER TABLE `File` ADD CONSTRAINT `File_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `file_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `file_versions` ADD CONSTRAINT `file_versions_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `file_storage_locations` ADD CONSTRAINT `file_storage_locations_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `file_storage_locations` ADD CONSTRAINT `file_storage_locations_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `file_versions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `file_storage_locations` ADD CONSTRAINT `file_storage_locations_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `file_storage_providers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `file_relations` ADD CONSTRAINT `file_relations_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `file_folders` ADD CONSTRAINT `file_folders_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `file_folders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `file_folder_relations` ADD CONSTRAINT `file_folder_relations_folderId_fkey` FOREIGN KEY (`folderId`) REFERENCES `file_folders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `file_folder_relations` ADD CONSTRAINT `file_folder_relations_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `file_tag_relations` ADD CONSTRAINT `file_tag_relations_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `file_tag_relations` ADD CONSTRAINT `file_tag_relations_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `file_tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `file_permissions` ADD CONSTRAINT `file_permissions_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `file_shares` ADD CONSTRAINT `file_shares_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `file_share_access_logs` ADD CONSTRAINT `file_share_access_logs_shareId_fkey` FOREIGN KEY (`shareId`) REFERENCES `file_shares`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `file_migration_items` ADD CONSTRAINT `file_migration_items_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `file_migration_jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed kategori dasar
INSERT INTO `file_categories` (`code`, `name`, `allowedExtensions`, `maxFileSize`, `isConfidential`, `isActive`) VALUES
    ('DOCUMENT', 'Dokumen', '["pdf","doc","docx","xls","xlsx","csv","txt","md"]', NULL, false, true),
    ('IMAGE', 'Gambar', '["jpg","jpeg","png","webp"]', NULL, false, true),
    ('VIDEO', 'Video', '["mp4","mkv"]', NULL, false, true),
    ('AUDIO', 'Audio', '["mp3","wav"]', NULL, false, true),
    ('ARCHIVE', 'Arsip', '["zip","rar"]', NULL, false, true),
    ('OTHER', 'Lainnya', NULL, NULL, false, true);

-- Seed provider lokal (default)
INSERT INTO `file_storage_providers` (`name`, `type`, `adapterCode`, `config`, `source`, `status`, `isDefault`)
VALUES ('Server Lokal', 'LOCAL', 'local', '{}', 'DB', 'ACTIVE', true);

-- Backfill file lama
UPDATE `File` SET
    `fileCode` = CONCAT('FILE-', YEAR(`createdAt`), '-', LPAD(`id`, 6, '0')),
    `displayName` = `originalName`,
    `extension` = IF(LOCATE('.', `originalName`) > 0, LOWER(SUBSTRING_INDEX(`originalName`, '.', -1)), NULL),
    `categoryId` = (SELECT `id` FROM `file_categories` WHERE `code` = CASE
        WHEN `File`.`kind` = 'FOTO' THEN 'IMAGE'
        WHEN `File`.`kind` = 'VIDEO' THEN 'VIDEO'
        WHEN `File`.`kind` = 'DOKUMEN' THEN 'DOCUMENT'
        ELSE 'OTHER' END);

INSERT INTO `file_versions` (`fileId`, `versionNumber`, `fileName`, `fileSize`, `mimeType`, `createdById`, `createdAt`, `status`)
SELECT `id`, 1, `originalName`, `size`, `mimeType`, `uploadedById`, `createdAt`, 'CURRENT' FROM `File`;

UPDATE `File` f JOIN `file_versions` v ON v.`fileId` = f.`id` AND v.`versionNumber` = 1 SET f.`currentVersionId` = v.`id`;

INSERT INTO `file_storage_locations` (`fileId`, `versionId`, `providerId`, `storageKey`, `isPrimary`, `replicaStatus`, `verificationStatus`)
SELECT f.`id`, v.`id`, (SELECT `id` FROM `file_storage_providers` WHERE `name` = 'Server Lokal'), f.`path`, true, 'PRIMARY', 'UNVERIFIED'
FROM `File` f JOIN `file_versions` v ON v.`fileId` = f.`id` AND v.`versionNumber` = 1;
