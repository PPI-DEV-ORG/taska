-- AlterTable Project
ALTER TABLE `Project` ADD COLUMN `boqFileId` INTEGER NULL;

-- AlterTable PurchaseRequest
ALTER TABLE `PurchaseRequest` ADD COLUMN `doFileId` INTEGER NULL;

-- AlterTable Supplier
ALTER TABLE `Supplier` ADD COLUMN `taxStatus` VARCHAR(191) NULL DEFAULT 'NON_PKP';

-- AlterTable StockReservation
ALTER TABLE `StockReservation` MODIFY `projectId` INTEGER NULL,
    ADD COLUMN `quotationId` INTEGER NULL,
    ADD COLUMN `invoiceId` INTEGER NULL,
    ADD COLUMN `purchaseRequestId` INTEGER NULL;

-- AlterTable ProjectRequirement
ALTER TABLE `ProjectRequirement` ADD COLUMN `serials` TEXT NULL;

-- AlterTable PurchaseRequestItem
ALTER TABLE `PurchaseRequestItem` ADD COLUMN `serials` TEXT NULL;

-- CreateTable SupplierItemTag
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

-- CreateTable Attendance
CREATE TABLE IF NOT EXISTS `Attendance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `checkIn` DATETIME(3) NULL,
    `checkOut` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'HADIR',
    `overtimeHours` DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Attendance_date_idx`(`date`),
    UNIQUE INDEX `Attendance_userId_date_key`(`userId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable SalaryConfig
CREATE TABLE IF NOT EXISTS `SalaryConfig` (
    `userId` INTEGER NOT NULL,
    `basicSalary` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `allowance` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `ptkp` VARCHAR(191) NOT NULL DEFAULT 'TK/0',
    `hasNpwp` BOOLEAN NOT NULL DEFAULT true,
    `pph21Rate` DECIMAL(6, 3) NULL,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable PayrollSlip
CREATE TABLE IF NOT EXISTS `PayrollSlip` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `period` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `basicSalary` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `allowance` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `overtimePay` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `absentDeduct` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `grossSalary` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `bpjs` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `pph21` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `netSalary` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `workDays` INTEGER NOT NULL DEFAULT 0,
    `presentDays` INTEGER NOT NULL DEFAULT 0,
    `absentDays` INTEGER NOT NULL DEFAULT 0,
    `lateCount` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PayrollSlip_period_idx`(`period`),
    UNIQUE INDEX `PayrollSlip_period_userId_key`(`period`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `StockReservation_quotationId_idx` ON `StockReservation`(`quotationId`);
CREATE INDEX `StockReservation_invoiceId_idx` ON `StockReservation`(`invoiceId`);
CREATE INDEX `StockReservation_purchaseRequestId_idx` ON `StockReservation`(`purchaseRequestId`);

