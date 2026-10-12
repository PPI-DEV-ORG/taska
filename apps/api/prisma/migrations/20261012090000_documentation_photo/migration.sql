-- CreateTable
CREATE TABLE `DocumentationPhoto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` INTEGER NOT NULL,
    `fileId` INTEGER NOT NULL,
    `caption` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DocumentationPhoto_entityType_entityId_idx`(`entityType`, `entityId`),
    UNIQUE INDEX `DocumentationPhoto_entityType_entityId_fileId_key`(`entityType`, `entityId`, `fileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DocumentationPhoto` ADD CONSTRAINT `DocumentationPhoto_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

