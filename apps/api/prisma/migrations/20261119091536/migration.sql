/*
  Warnings:

  - You are about to drop the column `acquisitionDate` on the `fa_acquisitions` table. All the data in the column will be lost.
  - You are about to drop the column `fundingSourceAccount` on the `fa_acquisitions` table. All the data in the column will be lost.
  - You are about to drop the column `amortizationDate` on the `fa_amortization_schedules` table. All the data in the column will be lost.
  - You are about to drop the column `beginningBookValue` on the `fa_amortization_schedules` table. All the data in the column will be lost.
  - You are about to drop the column `journalNumber` on the `fa_amortization_schedules` table. All the data in the column will be lost.
  - You are about to drop the column `assignedById` on the `fa_asset_assignments` table. All the data in the column will be lost.
  - You are about to drop the column `bastNumber` on the `fa_asset_assignments` table. All the data in the column will be lost.
  - You are about to drop the column `bastUrl` on the `fa_asset_assignments` table. All the data in the column will be lost.
  - You are about to drop the column `conditionAtAssignment` on the `fa_asset_assignments` table. All the data in the column will be lost.
  - You are about to drop the column `conditionAtReturn` on the `fa_asset_assignments` table. All the data in the column will be lost.
  - You are about to drop the column `purpose` on the `fa_asset_assignments` table. All the data in the column will be lost.
  - You are about to drop the column `receivedById` on the `fa_asset_assignments` table. All the data in the column will be lost.
  - You are about to drop the column `approvalStatus` on the `fa_asset_disposals` table. All the data in the column will be lost.
  - You are about to drop the column `buyerOrRecipient` on the `fa_asset_disposals` table. All the data in the column will be lost.
  - You are about to drop the column `depositAccountCode` on the `fa_asset_disposals` table. All the data in the column will be lost.
  - You are about to drop the column `disposalCosts` on the `fa_asset_disposals` table. All the data in the column will be lost.
  - You are about to drop the column `journalNumber` on the `fa_asset_disposals` table. All the data in the column will be lost.
  - You are about to drop the column `salePrice` on the `fa_asset_disposals` table. All the data in the column will be lost.
  - You are about to drop the column `adjustmentAmount` on the `fa_asset_revaluations` table. All the data in the column will be lost.
  - You are about to drop the column `appraiserName` on the `fa_asset_revaluations` table. All the data in the column will be lost.
  - You are about to drop the column `createdById` on the `fa_asset_revaluations` table. All the data in the column will be lost.
  - You are about to drop the column `journalNumber` on the `fa_asset_revaluations` table. All the data in the column will be lost.
  - You are about to drop the column `newFairValue` on the `fa_asset_revaluations` table. All the data in the column will be lost.
  - You are about to drop the column `approvalStatus` on the `fa_asset_transfers` table. All the data in the column will be lost.
  - You are about to drop the column `bastNumber` on the `fa_asset_transfers` table. All the data in the column will be lost.
  - You are about to drop the column `bastUrl` on the `fa_asset_transfers` table. All the data in the column will be lost.
  - You are about to drop the column `acquisitionCost` on the `fa_depreciation_books` table. All the data in the column will be lost.
  - You are about to drop the column `bookValue` on the `fa_depreciation_books` table. All the data in the column will be lost.
  - You are about to drop the column `residualValue` on the `fa_depreciation_books` table. All the data in the column will be lost.
  - You are about to drop the column `beginningBookValue` on the `fa_depreciation_schedules` table. All the data in the column will be lost.
  - You are about to drop the column `depreciationDate` on the `fa_depreciation_schedules` table. All the data in the column will be lost.
  - You are about to drop the column `journalNumber` on the `fa_depreciation_schedules` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[assetId,periodYear,periodMonth]` on the table `fa_depreciation_schedules` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `monthIndex` to the `fa_amortization_schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `fa_amortization_schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `accumDepAtDisposal` to the `fa_asset_disposals` table without a default value. This is not possible if the table is not empty.
  - Added the required column `costAtDisposal` to the `fa_asset_disposals` table without a default value. This is not possible if the table is not empty.
  - Added the required column `differenceAmount` to the `fa_asset_revaluations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `newBookValue` to the `fa_asset_revaluations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `fa_asset_revaluations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `currentBookValue` to the `fa_depreciation_books` table without a default value. This is not possible if the table is not empty.
  - Added the required column `monthIndex` to the `fa_depreciation_schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `fa_depreciation_schedules` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `fa_acquisitions` DROP COLUMN `acquisitionDate`,
    DROP COLUMN `fundingSourceAccount`,
    ADD COLUMN `approvedById` INTEGER NULL,
    ADD COLUMN `invoiceDate` DATE NULL,
    ADD COLUMN `poNumber` VARCHAR(191) NULL,
    ADD COLUMN `receivingId` INTEGER NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'COMPLETED',
    MODIFY `code` VARCHAR(191) NOT NULL,
    MODIFY `source` VARCHAR(191) NOT NULL,
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `fa_amortization_schedules` DROP COLUMN `amortizationDate`,
    DROP COLUMN `beginningBookValue`,
    DROP COLUMN `journalNumber`,
    ADD COLUMN `journalEntryId` INTEGER NULL,
    ADD COLUMN `monthIndex` INTEGER NOT NULL,
    ADD COLUMN `postedById` INTEGER NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `fa_asset_assignments` DROP COLUMN `assignedById`,
    DROP COLUMN `bastNumber`,
    DROP COLUMN `bastUrl`,
    DROP COLUMN `conditionAtAssignment`,
    DROP COLUMN `conditionAtReturn`,
    DROP COLUMN `purpose`,
    DROP COLUMN `receivedById`,
    ADD COLUMN `approvedById` INTEGER NULL,
    ADD COLUMN `conditionAtHandover` VARCHAR(191) NOT NULL DEFAULT 'GOOD',
    ADD COLUMN `createdById` INTEGER NULL,
    ADD COLUMN `handoverDocumentUrl` TEXT NULL,
    ADD COLUMN `locationId` INTEGER NULL,
    ADD COLUMN `notes` TEXT NULL,
    ADD COLUMN `returnCondition` VARCHAR(191) NULL,
    ADD COLUMN `signedAt` DATETIME(3) NULL,
    MODIFY `code` VARCHAR(191) NOT NULL,
    MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `fa_asset_audit_items` MODIFY `expectedCondition` VARCHAR(191) NULL,
    MODIFY `actualCondition` VARCHAR(191) NULL,
    MODIFY `scanStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `fa_asset_audits` MODIFY `code` VARCHAR(191) NOT NULL,
    MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'IN_PROGRESS',
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `fa_asset_disposals` DROP COLUMN `approvalStatus`,
    DROP COLUMN `buyerOrRecipient`,
    DROP COLUMN `depositAccountCode`,
    DROP COLUMN `disposalCosts`,
    DROP COLUMN `journalNumber`,
    DROP COLUMN `salePrice`,
    ADD COLUMN `accumDepAtDisposal` DECIMAL(18, 2) NOT NULL,
    ADD COLUMN `buyerName` VARCHAR(191) NULL,
    ADD COLUMN `costAtDisposal` DECIMAL(18, 2) NOT NULL,
    ADD COLUMN `createdById` INTEGER NULL,
    ADD COLUMN `disposalPrice` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN `documentUrl` TEXT NULL,
    ADD COLUMN `journalEntryId` INTEGER NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'APPROVED',
    MODIFY `code` VARCHAR(191) NOT NULL,
    MODIFY `disposalType` VARCHAR(191) NOT NULL,
    ALTER COLUMN `gainLossAmount` DROP DEFAULT,
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `fa_asset_documents` MODIFY `type` VARCHAR(191) NOT NULL DEFAULT 'DOCUMENT',
    MODIFY `mimeType` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `fa_asset_ledger` MODIFY `transactionType` VARCHAR(191) NOT NULL,
    MODIFY `referenceCode` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `fa_asset_maintenance_refs` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `fa_asset_revaluations` DROP COLUMN `adjustmentAmount`,
    DROP COLUMN `appraiserName`,
    DROP COLUMN `createdById`,
    DROP COLUMN `journalNumber`,
    DROP COLUMN `newFairValue`,
    ADD COLUMN `approvedById` INTEGER NULL,
    ADD COLUMN `differenceAmount` DECIMAL(18, 2) NOT NULL,
    ADD COLUMN `journalEntryId` INTEGER NULL,
    ADD COLUMN `newBookValue` DECIMAL(18, 2) NOT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    MODIFY `code` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `fa_asset_transfers` DROP COLUMN `approvalStatus`,
    DROP COLUMN `bastNumber`,
    DROP COLUMN `bastUrl`,
    ADD COLUMN `condition` VARCHAR(191) NOT NULL DEFAULT 'GOOD',
    ADD COLUMN `createdById` INTEGER NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'APPROVED',
    MODIFY `code` VARCHAR(191) NOT NULL,
    MODIFY `reason` TEXT NULL,
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `fa_assets` MODIFY `assetCode` VARCHAR(191) NOT NULL,
    MODIFY `type` VARCHAR(191) NOT NULL DEFAULT 'TANGIBLE',
    MODIFY `depreciationMethod` VARCHAR(191) NOT NULL DEFAULT 'STRAIGHT_LINE',
    MODIFY `condition` VARCHAR(191) NOT NULL DEFAULT 'GOOD',
    MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'REGISTERED',
    MODIFY `acquisitionSource` VARCHAR(191) NOT NULL DEFAULT 'DIRECT_PURCHASE',
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `fa_categories` MODIFY `code` VARCHAR(191) NOT NULL,
    MODIFY `type` VARCHAR(191) NOT NULL DEFAULT 'TANGIBLE',
    MODIFY `depreciationMethod` VARCHAR(191) NOT NULL DEFAULT 'STRAIGHT_LINE',
    MODIFY `assetAccountCode` VARCHAR(191) NULL,
    MODIFY `accumDepAccountCode` VARCHAR(191) NULL,
    MODIFY `depExpenseAccountCode` VARCHAR(191) NULL,
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `fa_depreciation_books` DROP COLUMN `acquisitionCost`,
    DROP COLUMN `bookValue`,
    DROP COLUMN `residualValue`,
    ADD COLUMN `currentBookValue` DECIMAL(18, 2) NOT NULL,
    ADD COLUMN `salvageValue` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    MODIFY `bookType` VARCHAR(191) NOT NULL DEFAULT 'COMMERCIAL',
    MODIFY `depreciationMethod` VARCHAR(191) NOT NULL DEFAULT 'STRAIGHT_LINE',
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `fa_depreciation_schedules` DROP COLUMN `beginningBookValue`,
    DROP COLUMN `depreciationDate`,
    DROP COLUMN `journalNumber`,
    ADD COLUMN `journalEntryId` INTEGER NULL,
    ADD COLUMN `monthIndex` INTEGER NOT NULL,
    ADD COLUMN `postedById` INTEGER NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `fa_locations` MODIFY `code` VARCHAR(191) NOT NULL,
    MODIFY `floor` VARCHAR(191) NULL,
    MODIFY `room` VARCHAR(191) NULL,
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX `fa_depreciation_schedules_assetId_periodYear_periodMonth_key` ON `fa_depreciation_schedules`(`assetId`, `periodYear`, `periodMonth`);

-- AddForeignKey
ALTER TABLE `fa_assets` ADD CONSTRAINT `fa_assets_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `fa_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fa_assets` ADD CONSTRAINT `fa_assets_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `fa_locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fa_assets` ADD CONSTRAINT `fa_assets_assignedUserId_fkey` FOREIGN KEY (`assignedUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fa_asset_assignments` ADD CONSTRAINT `fa_asset_assignments_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `fa_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fa_asset_assignments` ADD CONSTRAINT `fa_asset_assignments_assignedToUserId_fkey` FOREIGN KEY (`assignedToUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fa_asset_transfers` ADD CONSTRAINT `fa_asset_transfers_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `fa_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fa_depreciation_schedules` ADD CONSTRAINT `fa_depreciation_schedules_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `fa_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fa_amortization_schedules` ADD CONSTRAINT `fa_amortization_schedules_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `fa_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fa_asset_disposals` ADD CONSTRAINT `fa_asset_disposals_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `fa_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fa_asset_audit_items` ADD CONSTRAINT `fa_asset_audit_items_auditId_fkey` FOREIGN KEY (`auditId`) REFERENCES `fa_asset_audits`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fa_asset_audit_items` ADD CONSTRAINT `fa_asset_audit_items_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `fa_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fa_asset_documents` ADD CONSTRAINT `fa_asset_documents_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `fa_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fa_asset_maintenance_refs` ADD CONSTRAINT `fa_asset_maintenance_refs_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `fa_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fa_asset_maintenance_refs` ADD CONSTRAINT `fa_asset_maintenance_refs_maintenanceReportId_fkey` FOREIGN KEY (`maintenanceReportId`) REFERENCES `MaintenanceReport`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fa_asset_ledger` ADD CONSTRAINT `fa_asset_ledger_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `fa_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `fa_amortization_schedules` RENAME INDEX `fa_amort_sched_asset_period_key` TO `fa_amortization_schedules_assetId_periodYear_periodMonth_key`;

-- RenameIndex
ALTER TABLE `fa_asset_maintenance_refs` RENAME INDEX `fa_asset_maint_assetId_idx` TO `fa_asset_maintenance_refs_assetId_idx`;

-- RenameIndex
ALTER TABLE `fa_asset_maintenance_refs` RENAME INDEX `fa_asset_maint_maintReportId_idx` TO `fa_asset_maintenance_refs_maintenanceReportId_idx`;
