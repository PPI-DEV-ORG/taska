-- DropForeignKey
ALTER TABLE `Quotation` DROP FOREIGN KEY `Quotation_leadId_fkey`;

-- AlterTable
ALTER TABLE `Quotation` MODIFY `leadId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

