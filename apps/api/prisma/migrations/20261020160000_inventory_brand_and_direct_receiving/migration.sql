-- AlterTable
ALTER TABLE `Product` ADD COLUMN `brand` VARCHAR(191) NULL,
    ADD COLUMN `description` TEXT NULL;

-- AlterTable
ALTER TABLE `Receiving` MODIFY `supplierPoId` INTEGER NULL,
    ADD COLUMN `supplierName` VARCHAR(191) NULL;

