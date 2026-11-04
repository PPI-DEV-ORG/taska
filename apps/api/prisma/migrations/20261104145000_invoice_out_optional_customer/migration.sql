-- DropForeignKey
ALTER TABLE `InvoiceOut` DROP FOREIGN KEY `InvoiceOut_customerId_fkey`;

-- AlterTable
ALTER TABLE `InvoiceOut` MODIFY `customerId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `InvoiceOut` ADD CONSTRAINT `InvoiceOut_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

