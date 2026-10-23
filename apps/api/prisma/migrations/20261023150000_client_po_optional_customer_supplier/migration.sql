-- AlterTable
ALTER TABLE `ClientPO` MODIFY `customerId` INTEGER NULL,
    ADD COLUMN `supplierId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `ClientPO_supplierId_idx` ON `ClientPO`(`supplierId`);

-- AddForeignKey
ALTER TABLE `ClientPO` ADD CONSTRAINT `ClientPO_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

