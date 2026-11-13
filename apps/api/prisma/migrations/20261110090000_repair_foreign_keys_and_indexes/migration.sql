-- Menyamakan database dengan schema.prisma.
-- Sebelumnya ~33 foreign key (Poc, Kunjungan, Kalender, Reservasi Stok, COA, Tag Supplier, dst.) dan 4 indeks belum ada,
-- sehingga data bisa menunjuk ke dokumen yang sudah dihapus. Sebelum dibuat, semua foreign key sudah dicek: tidak ada baris yatim.

-- DropForeignKey
ALTER TABLE `ClientPO` DROP FOREIGN KEY `ClientPO_customerId_fkey`;

-- DropForeignKey
ALTER TABLE `PurchaseRequestItem` DROP FOREIGN KEY `PurchaseRequestItem_productId_fkey`;

-- DropForeignKey
ALTER TABLE `Receiving` DROP FOREIGN KEY `Receiving_supplierPoId_fkey`;

-- DropForeignKey
ALTER TABLE `StockReservation` DROP FOREIGN KEY `StockReservation_projectId_fkey`;

-- DropForeignKey
ALTER TABLE `SupplierPOItem` DROP FOREIGN KEY `SupplierPOItem_productId_fkey`;

-- DropIndex
DROP INDEX `PurchaseRequestItem_productId_fkey` ON `PurchaseRequestItem`;

-- DropIndex
DROP INDEX `SupplierPOItem_productId_fkey` ON `SupplierPOItem`;

-- Create baseline tables if missing in shadow database
CREATE TABLE IF NOT EXISTS `SupplierItemTag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `supplierId` INTEGER NOT NULL,
    `itemName` VARCHAR(191) NOT NULL,
    `price` DECIMAL(18, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SupplierItemTag_supplierId_idx`(`supplierId`),
    INDEX `SupplierItemTag_itemName_idx`(`itemName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `VisitActivityType` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `status` ENUM('AKTIF', 'NONAKTIF') NOT NULL DEFAULT 'AKTIF',

    UNIQUE INDEX `VisitActivityType_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Attendance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `checkIn` DATETIME(3) NULL,
    `checkOut` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'HADIR',
    `overtimeHours` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Attendance_userId_date_key`(`userId`, `date`),
    INDEX `Attendance_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SalaryConfig` (
    `userId` INTEGER NOT NULL,
    `basicSalary` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `allowance` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `ptkp` VARCHAR(191) NOT NULL DEFAULT 'TK/0',
    `hasNpwp` BOOLEAN NOT NULL DEFAULT true,
    `pph21Rate` DECIMAL(6, 3) NULL,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PayrollSlip` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `period` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `basicSalary` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `allowance` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `overtimePay` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `absentDeduct` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `grossSalary` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `bpjs` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `pph21` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `netSalary` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `workDays` INTEGER NOT NULL DEFAULT 0,
    `presentDays` INTEGER NOT NULL DEFAULT 0,
    `absentDays` INTEGER NOT NULL DEFAULT 0,
    `lateCount` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PayrollSlip_period_userId_key`(`period`, `userId`),
    INDEX `PayrollSlip_period_idx`(`period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PocReport` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `date` DATE NOT NULL,
    `endDate` DATE NULL,
    `location` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'DEMO_CLIENT',
    `status` VARCHAR(191) NOT NULL DEFAULT 'Draft',
    `resultStatus` VARCHAR(191) NULL,
    `clientName` VARCHAR(191) NULL,
    `customerId` INTEGER NULL,
    `projectId` INTEGER NULL,
    `leadId` INTEGER NULL,
    `targetCriteria` TEXT NULL,
    `productsTested` TEXT NULL,
    `budget` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `actualCost` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `actualExecutionDate` DATE NULL,
    `actualAttendees` TEXT NULL,
    `activitiesDone` TEXT NULL,
    `testResults` TEXT NULL,
    `issuesFound` TEXT NULL,
    `followUpNeeded` TEXT NULL,
    `conclusion` TEXT NULL,
    `recommendations` TEXT NULL,
    `companyHeader` VARCHAR(191) NULL,
    `logoFileId` INTEGER NULL,
    `documentFileId` INTEGER NULL,
    `ownerId` INTEGER NOT NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PocReport_number_key`(`number`),
    INDEX `PocReport_status_idx`(`status`),
    INDEX `PocReport_date_idx`(`date`),
    INDEX `PocReport_ownerId_idx`(`ownerId`),
    INDEX `PocReport_projectId_idx`(`projectId`),
    INDEX `PocReport_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PocMember` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pocReportId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `PocMember_pocReportId_userId_key`(`pocReportId`, `userId`),
    INDEX `PocMember_pocReportId_idx`(`pocReportId`),
    INDEX `PocMember_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PocChecklist` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pocReportId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `isDone` BOOLEAN NOT NULL DEFAULT false,
    `dueDate` DATE NULL,
    `assigneeId` INTEGER NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `PocChecklist_pocReportId_idx`(`pocReportId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `VisitReport` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `activityTypeId` INTEGER NULL,
    `activityTypeName` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Planned',
    `date` DATE NOT NULL,
    `endDate` DATE NULL,
    `location` VARCHAR(191) NULL,
    `clientName` VARCHAR(191) NULL,
    `clientContact` VARCHAR(191) NULL,
    `customerId` INTEGER NULL,
    `leadId` INTEGER NULL,
    `projectId` INTEGER NULL,
    `purpose` TEXT NULL,
    `description` TEXT NULL,
    `summary` TEXT NULL,
    `clientNeeds` TEXT NULL,
    `productsIntroduced` TEXT NULL,
    `clientFeedback` TEXT NULL,
    `agreements` TEXT NULL,
    `potentialOpportunities` TEXT NULL,
    `obstacles` TEXT NULL,
    `conclusion` TEXT NULL,
    `companyHeader` VARCHAR(191) NULL,
    `logoFileId` INTEGER NULL,
    `documentFileId` INTEGER NULL,
    `ownerId` INTEGER NOT NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `VisitReport_number_key`(`number`),
    INDEX `VisitReport_status_idx`(`status`),
    INDEX `VisitReport_date_idx`(`date`),
    INDEX `VisitReport_ownerId_idx`(`ownerId`),
    INDEX `VisitReport_projectId_idx`(`projectId`),
    INDEX `VisitReport_customerId_idx`(`customerId`),
    INDEX `VisitReport_leadId_idx`(`leadId`),
    INDEX `VisitReport_activityTypeId_idx`(`activityTypeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `VisitMember` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `visitReportId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `VisitMember_visitReportId_userId_key`(`visitReportId`, `userId`),
    INDEX `VisitMember_visitReportId_idx`(`visitReportId`),
    INDEX `VisitMember_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `VisitActionItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `visitReportId` INTEGER NOT NULL,
    `task` TEXT NOT NULL,
    `assigneeId` INTEGER NULL,
    `dueDate` DATE NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Open',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `VisitActionItem_visitReportId_idx`(`visitReportId`),
    INDEX `VisitActionItem_assigneeId_idx`(`assigneeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CalendarEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'MEETING',
    `status` VARCHAR(191) NOT NULL DEFAULT 'NOT_STARTED',
    `priority` VARCHAR(191) NOT NULL DEFAULT 'MEDIUM',
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `isAllDay` BOOLEAN NOT NULL DEFAULT false,
    `recurrence` VARCHAR(191) NOT NULL DEFAULT 'NONE',
    `recurrenceUntil` DATETIME(3) NULL,
    `reminderMinutes` INTEGER NULL,
    `lastRemindedAt` DATETIME(3) NULL,
    `completionNote` TEXT NULL,
    `creatorId` INTEGER NOT NULL,
    `assigneeId` INTEGER NULL,
    `customerId` INTEGER NULL,
    `projectId` INTEGER NULL,
    `leadId` INTEGER NULL,
    `invoiceId` INTEGER NULL,
    `supplierId` INTEGER NULL,
    `excludedDates` TEXT NULL,
    `overdueNotifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CalendarEvent_number_key`(`number`),
    INDEX `CalendarEvent_startDate_idx`(`startDate`),
    INDEX `CalendarEvent_assigneeId_idx`(`assigneeId`),
    INDEX `CalendarEvent_creatorId_idx`(`creatorId`),
    INDEX `CalendarEvent_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CalendarAttendee` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eventId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `CalendarAttendee_eventId_userId_key`(`eventId`, `userId`),
    INDEX `CalendarAttendee_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CoaAccount` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `normalBalance` VARCHAR(191) NOT NULL DEFAULT 'DEBIT',
    `type` VARCHAR(191) NULL,
    `parentCode` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'AKTIF',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CoaAccount_code_key`(`code`),
    INDEX `CoaAccount_parentCode_idx`(`parentCode`),
    INDEX `CoaAccount_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Ensure missing columns on existing tables exist before modifying or indexing
ALTER TABLE `Supplier` ADD COLUMN `taxStatus` VARCHAR(191) NULL DEFAULT 'NON_PKP';

ALTER TABLE `Project` ADD COLUMN `boqFileId` INTEGER NULL;

ALTER TABLE `ProjectRequirement` ADD COLUMN `serials` LONGTEXT NULL;

ALTER TABLE `PurchaseRequest` 
    ADD COLUMN `procurementSource` VARCHAR(191) NULL DEFAULT 'SUPPLIER',
    ADD COLUMN `paymentMethod` VARCHAR(191) NULL DEFAULT 'UTANG',
    ADD COLUMN `doFileId` INTEGER NULL;

ALTER TABLE `PurchaseRequestItem` 
    MODIFY `productId` INTEGER NULL,
    ADD COLUMN `customName` VARCHAR(191) NULL,
    ADD COLUMN `customUnit` VARCHAR(191) NULL,
    ADD COLUMN `serials` LONGTEXT NULL;

ALTER TABLE `SupplierPOItem` 
    MODIFY `productId` INTEGER NULL,
    ADD COLUMN `customName` VARCHAR(191) NULL,
    ADD COLUMN `customUnit` VARCHAR(191) NULL;

ALTER TABLE `FollowUp` 
    ADD COLUMN `pocReportId` INTEGER NULL,
    ADD COLUMN `visitReportId` INTEGER NULL;

ALTER TABLE `Expense` 
    ADD COLUMN `pocReportId` INTEGER NULL,
    ADD COLUMN `visitReportId` INTEGER NULL,
    ADD COLUMN `receiptFileIds` TEXT NULL,
    ADD COLUMN `fundingSource` VARCHAR(191) NOT NULL DEFAULT 'PERUSAHAAN',
    ADD COLUMN `reimbursementStatus` VARCHAR(191) NULL,
    ADD COLUMN `paymentMethod` VARCHAR(191) NULL,
    ADD COLUMN `approvedAmount` DECIMAL(18, 2) NULL,
    ADD COLUMN `paidAmount` DECIMAL(18, 2) NULL,
    ADD COLUMN `paidById` INTEGER NULL;

ALTER TABLE `StockReservation` 
    MODIFY `projectId` INTEGER NULL,
    ADD COLUMN `quotationId` INTEGER NULL,
    ADD COLUMN `invoiceId` INTEGER NULL,
    ADD COLUMN `purchaseRequestId` INTEGER NULL;

-- AlterTable
ALTER TABLE `Attendance` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `AuditLog` MODIFY `detail` TEXT NULL;

-- AlterTable
ALTER TABLE `CalendarEvent` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `CoaAccount` MODIFY `code` VARCHAR(191) NOT NULL,
    MODIFY `normalBalance` VARCHAR(191) NOT NULL DEFAULT 'DEBIT',
    MODIFY `type` VARCHAR(191) NULL,
    MODIFY `parentCode` VARCHAR(191) NULL,
    MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'AKTIF',
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `DeliveryNoteItem` MODIFY `serials` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `PayrollSlip` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `PocChecklist` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `PocReport` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Receiving` MODIFY `conditionNote` TEXT NULL;

-- AlterTable
ALTER TABLE `ReceivingItem` MODIFY `note` TEXT NULL,
    MODIFY `serials` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `SalaryConfig` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Task` MODIFY `status` ENUM('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'REJECTED', 'PENDING', 'TESTED') NOT NULL DEFAULT 'TODO';

-- AlterTable
ALTER TABLE `VisitActionItem` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `VisitActivityType` MODIFY `status` ENUM('AKTIF', 'NONAKTIF') NOT NULL DEFAULT 'AKTIF';

-- AlterTable
ALTER TABLE `VisitReport` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- CreateIndex
CREATE INDEX `Expense_pocReportId_idx` ON `Expense`(`pocReportId`);

-- CreateIndex
CREATE INDEX `Expense_visitReportId_idx` ON `Expense`(`visitReportId`);

-- CreateIndex
CREATE INDEX `FollowUp_pocReportId_idx` ON `FollowUp`(`pocReportId`);

-- CreateIndex
CREATE INDEX `FollowUp_visitReportId_idx` ON `FollowUp`(`visitReportId`);

-- AddForeignKey
ALTER TABLE `SupplierItemTag` ADD CONSTRAINT `SupplierItemTag_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FollowUp` ADD CONSTRAINT `FollowUp_pocReportId_fkey` FOREIGN KEY (`pocReportId`) REFERENCES `PocReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FollowUp` ADD CONSTRAINT `FollowUp_visitReportId_fkey` FOREIGN KEY (`visitReportId`) REFERENCES `VisitReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientPO` ADD CONSTRAINT `ClientPO_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_pocReportId_fkey` FOREIGN KEY (`pocReportId`) REFERENCES `PocReport`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_visitReportId_fkey` FOREIGN KEY (`visitReportId`) REFERENCES `VisitReport`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseRequestItem` ADD CONSTRAINT `PurchaseRequestItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierPOItem` ADD CONSTRAINT `SupplierPOItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Receiving` ADD CONSTRAINT `Receiving_supplierPoId_fkey` FOREIGN KEY (`supplierPoId`) REFERENCES `SupplierPO`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockReservation` ADD CONSTRAINT `StockReservation_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockReservation` ADD CONSTRAINT `StockReservation_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `Quotation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockReservation` ADD CONSTRAINT `StockReservation_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `InvoiceOut`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockReservation` ADD CONSTRAINT `StockReservation_purchaseRequestId_fkey` FOREIGN KEY (`purchaseRequestId`) REFERENCES `PurchaseRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PocReport` ADD CONSTRAINT `PocReport_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PocReport` ADD CONSTRAINT `PocReport_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PocReport` ADD CONSTRAINT `PocReport_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PocReport` ADD CONSTRAINT `PocReport_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PocMember` ADD CONSTRAINT `PocMember_pocReportId_fkey` FOREIGN KEY (`pocReportId`) REFERENCES `PocReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PocMember` ADD CONSTRAINT `PocMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PocChecklist` ADD CONSTRAINT `PocChecklist_pocReportId_fkey` FOREIGN KEY (`pocReportId`) REFERENCES `PocReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisitReport` ADD CONSTRAINT `VisitReport_activityTypeId_fkey` FOREIGN KEY (`activityTypeId`) REFERENCES `VisitActivityType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisitReport` ADD CONSTRAINT `VisitReport_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisitReport` ADD CONSTRAINT `VisitReport_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisitReport` ADD CONSTRAINT `VisitReport_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisitReport` ADD CONSTRAINT `VisitReport_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisitMember` ADD CONSTRAINT `VisitMember_visitReportId_fkey` FOREIGN KEY (`visitReportId`) REFERENCES `VisitReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisitMember` ADD CONSTRAINT `VisitMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisitActionItem` ADD CONSTRAINT `VisitActionItem_visitReportId_fkey` FOREIGN KEY (`visitReportId`) REFERENCES `VisitReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarEvent` ADD CONSTRAINT `CalendarEvent_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarEvent` ADD CONSTRAINT `CalendarEvent_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarAttendee` ADD CONSTRAINT `CalendarAttendee_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `CalendarEvent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarAttendee` ADD CONSTRAINT `CalendarAttendee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CoaAccount` ADD CONSTRAINT `CoaAccount_parentCode_fkey` FOREIGN KEY (`parentCode`) REFERENCES `CoaAccount`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `Expense` RENAME INDEX `Expense_surveyId_fkey` TO `Expense_surveyId_idx`;

