-- Proyek menyimpan prospek asalnya (juga bila prospek belum punya penawaran).
ALTER TABLE `Project` ADD COLUMN `leadId` INTEGER NULL;
CREATE INDEX `Project_leadId_idx` ON `Project`(`leadId`);
ALTER TABLE `Project` ADD CONSTRAINT `Project_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Isi dari penawaran untuk proyek yang sudah ada.
UPDATE `Project` p
    JOIN `Quotation` q ON q.`id` = p.`quotationId`
    SET p.`leadId` = q.`leadId`
    WHERE p.`leadId` IS NULL AND q.`leadId` IS NOT NULL;
