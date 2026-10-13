-- DropForeignKey
ALTER TABLE `Receiving` DROP FOREIGN KEY `Receiving_warehouseId_fkey`;

-- DropIndex
DROP INDEX `Approval_kind_entityId_idx` ON `Approval`;

-- AlterTable
ALTER TABLE `Receiving` ADD COLUMN `projectId` INTEGER NULL,
    MODIFY `warehouseId` INTEGER NULL;

-- AlterTable
ALTER TABLE `ReceivingItem` ADD COLUMN `serials` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `SupplierPO` ADD COLUMN `projectId` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Approval_kind_entityId_key` ON `Approval`(`kind`, `entityId`);

-- AddForeignKey
ALTER TABLE `SupplierPO` ADD CONSTRAINT `SupplierPO_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Receiving` ADD CONSTRAINT `Receiving_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Receiving` ADD CONSTRAINT `Receiving_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

