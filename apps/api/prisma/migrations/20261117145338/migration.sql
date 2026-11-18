-- AlterTable
ALTER TABLE `DeliveryNote` MODIFY `reportText` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `Expense` ADD COLUMN `maintenanceReportId` INTEGER NULL;

-- AlterTable
ALTER TABLE `FollowUp` ADD COLUMN `maintenanceReportId` INTEGER NULL;

-- AlterTable
ALTER TABLE `SystemSetting` MODIFY `value` LONGTEXT NOT NULL;

-- CreateTable
CREATE TABLE `MaintenanceReport` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `maintenanceType` VARCHAR(191) NOT NULL DEFAULT 'Preventive',
    `status` VARCHAR(191) NOT NULL DEFAULT 'Scheduled',
    `startDate` DATE NOT NULL,
    `endDate` DATE NULL,
    `location` VARCHAR(191) NULL,
    `clientName` VARCHAR(191) NULL,
    `clientContact` VARCHAR(191) NULL,
    `customerId` INTEGER NULL,
    `leadId` INTEGER NULL,
    `projectId` INTEGER NULL,
    `purpose` TEXT NULL,
    `description` TEXT NULL,
    `findings` TEXT NULL,
    `actionsTaken` TEXT NULL,
    `recommendations` TEXT NULL,
    `conclusion` TEXT NULL,
    `companyHeader` VARCHAR(191) NULL,
    `logoFileId` INTEGER NULL,
    `documentFileId` INTEGER NULL,
    `ownerId` INTEGER NOT NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MaintenanceReport_number_key`(`number`),
    INDEX `MaintenanceReport_status_idx`(`status`),
    INDEX `MaintenanceReport_startDate_idx`(`startDate`),
    INDEX `MaintenanceReport_ownerId_idx`(`ownerId`),
    INDEX `MaintenanceReport_projectId_idx`(`projectId`),
    INDEX `MaintenanceReport_customerId_idx`(`customerId`),
    INDEX `MaintenanceReport_leadId_idx`(`leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MaintenanceMember` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `maintenanceReportId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    INDEX `MaintenanceMember_maintenanceReportId_idx`(`maintenanceReportId`),
    INDEX `MaintenanceMember_userId_idx`(`userId`),
    UNIQUE INDEX `MaintenanceMember_maintenanceReportId_userId_key`(`maintenanceReportId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MaintenanceActionItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `maintenanceReportId` INTEGER NOT NULL,
    `task` TEXT NOT NULL,
    `assigneeId` INTEGER NULL,
    `dueDate` DATE NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Open',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MaintenanceActionItem_maintenanceReportId_idx`(`maintenanceReportId`),
    INDEX `MaintenanceActionItem_assigneeId_idx`(`assigneeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Expense_maintenanceReportId_idx` ON `Expense`(`maintenanceReportId`);

-- CreateIndex
CREATE INDEX `FollowUp_maintenanceReportId_idx` ON `FollowUp`(`maintenanceReportId`);

-- AddForeignKey
ALTER TABLE `FollowUp` ADD CONSTRAINT `FollowUp_maintenanceReportId_fkey` FOREIGN KEY (`maintenanceReportId`) REFERENCES `MaintenanceReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_maintenanceReportId_fkey` FOREIGN KEY (`maintenanceReportId`) REFERENCES `MaintenanceReport`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceReport` ADD CONSTRAINT `MaintenanceReport_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceReport` ADD CONSTRAINT `MaintenanceReport_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceReport` ADD CONSTRAINT `MaintenanceReport_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceReport` ADD CONSTRAINT `MaintenanceReport_logoFileId_fkey` FOREIGN KEY (`logoFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceReport` ADD CONSTRAINT `MaintenanceReport_documentFileId_fkey` FOREIGN KEY (`documentFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceReport` ADD CONSTRAINT `MaintenanceReport_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceReport` ADD CONSTRAINT `MaintenanceReport_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceMember` ADD CONSTRAINT `MaintenanceMember_maintenanceReportId_fkey` FOREIGN KEY (`maintenanceReportId`) REFERENCES `MaintenanceReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceMember` ADD CONSTRAINT `MaintenanceMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceActionItem` ADD CONSTRAINT `MaintenanceActionItem_maintenanceReportId_fkey` FOREIGN KEY (`maintenanceReportId`) REFERENCES `MaintenanceReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceActionItem` ADD CONSTRAINT `MaintenanceActionItem_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `StockReservation` RENAME INDEX `StockReservation_invoiceId_fkey` TO `StockReservation_invoiceId_idx`;

-- RenameIndex
ALTER TABLE `StockReservation` RENAME INDEX `StockReservation_purchaseRequestId_fkey` TO `StockReservation_purchaseRequestId_idx`;

-- RenameIndex
ALTER TABLE `StockReservation` RENAME INDEX `StockReservation_quotationId_fkey` TO `StockReservation_quotationId_idx`;

-- RenameIndex
ALTER TABLE `StockReservation` RENAME INDEX `StockReservation_serialUnitId_fkey` TO `StockReservation_serialUnitId_idx`;
