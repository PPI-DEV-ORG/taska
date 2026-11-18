-- Fixed Asset Management (16 Tables)

-- CreateTable fa_categories
CREATE TABLE IF NOT EXISTS `fa_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(32) NOT NULL DEFAULT 'TANGIBLE',
    `defaultUsefulLifeMonths` INTEGER NOT NULL DEFAULT 48,
    `depreciationMethod` VARCHAR(64) NOT NULL DEFAULT 'STRAIGHT_LINE',
    `defaultResidualRate` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `assetAccountCode` VARCHAR(64) NULL,
    `accumDepAccountCode` VARCHAR(64) NULL,
    `depExpenseAccountCode` VARCHAR(64) NULL,
    `capitalizationThreshold` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `fa_categories_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable fa_locations
CREATE TABLE IF NOT EXISTS `fa_locations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `building` VARCHAR(191) NULL,
    `floor` VARCHAR(64) NULL,
    `room` VARCHAR(64) NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `fa_locations_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable fa_assets
CREATE TABLE IF NOT EXISTS `fa_assets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetCode` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `categoryId` INTEGER NOT NULL,
    `type` VARCHAR(32) NOT NULL DEFAULT 'TANGIBLE',
    `description` TEXT NULL,
    `brand` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `serialNumber` VARCHAR(191) NULL,
    `acquisitionDate` DATE NOT NULL,
    `inServiceDate` DATE NOT NULL,
    `acquisitionCost` DECIMAL(18, 2) NOT NULL,
    `residualValue` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `usefulLifeMonths` INTEGER NOT NULL DEFAULT 48,
    `depreciationMethod` VARCHAR(64) NOT NULL DEFAULT 'STRAIGHT_LINE',
    `accumulatedDepreciation` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `bookValue` DECIMAL(18, 2) NOT NULL,
    `locationId` INTEGER NULL,
    `department` VARCHAR(191) NULL,
    `assignedUserId` INTEGER NULL,
    `warrantyExpiry` DATE NULL,
    `condition` VARCHAR(32) NOT NULL DEFAULT 'GOOD',
    `status` VARCHAR(32) NOT NULL DEFAULT 'REGISTERED',
    `photoUrl` TEXT NULL,
    `documentUrl` TEXT NULL,
    `qrCodeKey` VARCHAR(191) NULL,
    `acquisitionSource` VARCHAR(64) NOT NULL DEFAULT 'DIRECT_PURCHASE',
    `receivingId` INTEGER NULL,
    `purchaseRequestId` INTEGER NULL,
    `customFields` TEXT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `fa_assets_assetCode_key`(`assetCode`),
    UNIQUE INDEX `fa_assets_qrCodeKey_key`(`qrCodeKey`),
    INDEX `fa_assets_categoryId_idx`(`categoryId`),
    INDEX `fa_assets_locationId_idx`(`locationId`),
    INDEX `fa_assets_assignedUserId_idx`(`assignedUserId`),
    INDEX `fa_assets_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable fa_acquisitions
CREATE TABLE IF NOT EXISTS `fa_acquisitions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(64) NOT NULL,
    `source` VARCHAR(64) NOT NULL,
    `vendorName` VARCHAR(191) NULL,
    `invoiceNumber` VARCHAR(191) NULL,
    `acquisitionDate` DATE NOT NULL,
    `totalCost` DECIMAL(18, 2) NOT NULL,
    `fundingSourceAccount` VARCHAR(64) NULL,
    `notes` TEXT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `fa_acquisitions_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable fa_asset_assignments
CREATE TABLE IF NOT EXISTS `fa_asset_assignments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(64) NOT NULL,
    `assetId` INTEGER NOT NULL,
    `assignedToUserId` INTEGER NULL,
    `department` VARCHAR(191) NULL,
    `assignmentDate` DATE NOT NULL,
    `returnDate` DATE NULL,
    `conditionAtAssignment` VARCHAR(32) NOT NULL DEFAULT 'GOOD',
    `conditionAtReturn` VARCHAR(32) NULL,
    `purpose` TEXT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    `bastNumber` VARCHAR(64) NULL,
    `bastUrl` TEXT NULL,
    `assignedById` INTEGER NULL,
    `receivedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `fa_asset_assignments_code_key`(`code`),
    INDEX `fa_asset_assignments_assetId_idx`(`assetId`),
    INDEX `fa_asset_assignments_assignedToUserId_idx`(`assignedToUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable fa_asset_transfers
CREATE TABLE IF NOT EXISTS `fa_asset_transfers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(64) NOT NULL,
    `assetId` INTEGER NOT NULL,
    `fromUserId` INTEGER NULL,
    `toUserId` INTEGER NULL,
    `fromDepartment` VARCHAR(191) NULL,
    `toDepartment` VARCHAR(191) NULL,
    `fromLocationId` INTEGER NULL,
    `toLocationId` INTEGER NULL,
    `transferDate` DATE NOT NULL,
    `reason` TEXT NOT NULL,
    `approvalStatus` VARCHAR(32) NOT NULL DEFAULT 'APPROVED',
    `approvedById` INTEGER NULL,
    `bastNumber` VARCHAR(64) NULL,
    `bastUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `fa_asset_transfers_code_key`(`code`),
    INDEX `fa_asset_transfers_assetId_idx`(`assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable fa_depreciation_books
CREATE TABLE IF NOT EXISTS `fa_depreciation_books` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetId` INTEGER NOT NULL,
    `bookType` VARCHAR(32) NOT NULL DEFAULT 'COMMERCIAL',
    `usefulLifeMonths` INTEGER NOT NULL,
    `depreciationMethod` VARCHAR(64) NOT NULL DEFAULT 'STRAIGHT_LINE',
    `residualValue` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `acquisitionCost` DECIMAL(18, 2) NOT NULL,
    `accumulatedDepreciation` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `bookValue` DECIMAL(18, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `fa_depreciation_books_assetId_bookType_key`(`assetId`, `bookType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable fa_depreciation_schedules
CREATE TABLE IF NOT EXISTS `fa_depreciation_schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetId` INTEGER NOT NULL,
    `periodYear` INTEGER NOT NULL,
    `periodMonth` INTEGER NOT NULL,
    `depreciationDate` DATE NOT NULL,
    `beginningBookValue` DECIMAL(18, 2) NOT NULL,
    `depreciationAmount` DECIMAL(18, 2) NOT NULL,
    `accumulatedDepreciation` DECIMAL(18, 2) NOT NULL,
    `endingBookValue` DECIMAL(18, 2) NOT NULL,
    `isPosted` BOOLEAN NOT NULL DEFAULT false,
    `journalNumber` VARCHAR(64) NULL,
    `postedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `fa_depreciation_schedules_assetId_idx`(`assetId`),
    INDEX `fa_depreciation_schedules_periodYear_periodMonth_idx`(`periodYear`, `periodMonth`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable fa_amortization_schedules
CREATE TABLE IF NOT EXISTS `fa_amortization_schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetId` INTEGER NOT NULL,
    `periodYear` INTEGER NOT NULL,
    `periodMonth` INTEGER NOT NULL,
    `amortizationDate` DATE NOT NULL,
    `beginningBookValue` DECIMAL(18, 2) NOT NULL,
    `amortizationAmount` DECIMAL(18, 2) NOT NULL,
    `accumulatedAmortization` DECIMAL(18, 2) NOT NULL,
    `endingBookValue` DECIMAL(18, 2) NOT NULL,
    `isPosted` BOOLEAN NOT NULL DEFAULT false,
    `journalNumber` VARCHAR(64) NULL,
    `postedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `fa_amort_sched_asset_period_key`(`assetId`, `periodYear`, `periodMonth`),
    INDEX `fa_amortization_schedules_assetId_idx`(`assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable fa_asset_revaluations
CREATE TABLE IF NOT EXISTS `fa_asset_revaluations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(64) NOT NULL,
    `assetId` INTEGER NOT NULL,
    `revaluationDate` DATE NOT NULL,
    `previousBookValue` DECIMAL(18, 2) NOT NULL,
    `newFairValue` DECIMAL(18, 2) NOT NULL,
    `adjustmentAmount` DECIMAL(18, 2) NOT NULL,
    `appraiserName` VARCHAR(191) NULL,
    `reason` TEXT NOT NULL,
    `journalNumber` VARCHAR(64) NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `fa_asset_revaluations_code_key`(`code`),
    INDEX `fa_asset_revaluations_assetId_idx`(`assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable fa_asset_disposals
CREATE TABLE IF NOT EXISTS `fa_asset_disposals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(64) NOT NULL,
    `assetId` INTEGER NOT NULL,
    `disposalDate` DATE NOT NULL,
    `disposalType` VARCHAR(32) NOT NULL,
    `salePrice` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `bookValueAtDisposal` DECIMAL(18, 2) NOT NULL,
    `gainLossAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `disposalCosts` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `buyerOrRecipient` VARCHAR(191) NULL,
    `reason` TEXT NOT NULL,
    `approvalStatus` VARCHAR(32) NOT NULL DEFAULT 'APPROVED',
    `approvedById` INTEGER NULL,
    `journalNumber` VARCHAR(64) NULL,
    `depositAccountCode` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `fa_asset_disposals_code_key`(`code`),
    INDEX `fa_asset_disposals_assetId_idx`(`assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable fa_asset_audits
CREATE TABLE IF NOT EXISTS `fa_asset_audits` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(64) NOT NULL,
    `auditDate` DATE NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NULL,
    `locationId` INTEGER NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS',
    `totalAssets` INTEGER NOT NULL DEFAULT 0,
    `verifiedAssets` INTEGER NOT NULL DEFAULT 0,
    `discrepancyAssets` INTEGER NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `auditorId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `fa_asset_audits_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable fa_asset_audit_items
CREATE TABLE IF NOT EXISTS `fa_asset_audit_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `auditId` INTEGER NOT NULL,
    `assetId` INTEGER NOT NULL,
    `expectedLocationId` INTEGER NULL,
    `actualLocationId` INTEGER NULL,
    `expectedUserId` INTEGER NULL,
    `actualUserId` INTEGER NULL,
    `expectedCondition` VARCHAR(32) NULL,
    `actualCondition` VARCHAR(32) NULL,
    `scanStatus` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    `scannedAt` DATETIME(3) NULL,
    `scannedById` INTEGER NULL,
    `notes` TEXT NULL,
    `photoUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `fa_asset_audit_items_auditId_idx`(`auditId`),
    INDEX `fa_asset_audit_items_assetId_idx`(`assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable fa_asset_documents
CREATE TABLE IF NOT EXISTS `fa_asset_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `type` VARCHAR(32) NOT NULL DEFAULT 'DOCUMENT',
    `fileUrl` TEXT NOT NULL,
    `fileSize` INTEGER NULL,
    `mimeType` VARCHAR(64) NULL,
    `uploadedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `fa_asset_documents_assetId_idx`(`assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable fa_asset_maintenance_refs
CREATE TABLE IF NOT EXISTS `fa_asset_maintenance_refs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetId` INTEGER NOT NULL,
    `maintenanceReportId` INTEGER NULL,
    `serviceDate` DATE NOT NULL,
    `description` TEXT NOT NULL,
    `cost` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `isCapitalized` BOOLEAN NOT NULL DEFAULT false,
    `vendorName` VARCHAR(191) NULL,
    `nextServiceDate` DATE NULL,
    `technicianName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `fa_asset_maint_assetId_idx`(`assetId`),
    INDEX `fa_asset_maint_maintReportId_idx`(`maintenanceReportId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable fa_asset_ledger
CREATE TABLE IF NOT EXISTS `fa_asset_ledger` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetId` INTEGER NOT NULL,
    `transactionDate` DATE NOT NULL,
    `transactionType` VARCHAR(64) NOT NULL,
    `referenceCode` VARCHAR(64) NULL,
    `debit` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `credit` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `bookValueAfter` DECIMAL(18, 2) NOT NULL,
    `accumDepAfter` DECIMAL(18, 2) NOT NULL,
    `journalEntryId` INTEGER NULL,
    `description` TEXT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `fa_asset_ledger_assetId_idx`(`assetId`),
    INDEX `fa_asset_ledger_journalEntryId_idx`(`journalEntryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
