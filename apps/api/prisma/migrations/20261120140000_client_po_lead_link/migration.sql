-- Sales Order (ClientPO) menyimpan prospek asalnya (juga bila prospek belum punya penawaran).
ALTER TABLE `ClientPO` ADD COLUMN `leadId` INTEGER NULL;
CREATE INDEX `ClientPO_leadId_idx` ON `ClientPO`(`leadId`);
ALTER TABLE `ClientPO` ADD CONSTRAINT `ClientPO_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 1) Dari penawaran SO.
UPDATE `ClientPO` c
    JOIN `Quotation` q ON q.`id` = c.`quotationId`
    SET c.`leadId` = q.`leadId`
    WHERE c.`leadId` IS NULL AND q.`leadId` IS NOT NULL;

-- 2) Dari tag "[lead:N]" di catatan SO (cara lama menautkan SO ke prospek), hanya bila prospeknya ada.
UPDATE `ClientPO` c
    JOIN `Lead` l ON l.`id` = CAST(REGEXP_SUBSTR(REGEXP_SUBSTR(c.`notes`, '\\[lead:[0-9]+\\]'), '[0-9]+') AS UNSIGNED)
    SET c.`leadId` = l.`id`
    WHERE c.`leadId` IS NULL AND c.`notes` REGEXP '\\[lead:[0-9]+\\]';

-- 3) SO yang belum punya proyek -> proyek prospeknya (proyek tertua bila ada lebih dari satu).
UPDATE `ClientPO` c
    JOIN (SELECT `leadId`, MIN(`id`) AS `projectId` FROM `Project` WHERE `leadId` IS NOT NULL GROUP BY `leadId`) p ON p.`leadId` = c.`leadId`
    SET c.`projectId` = p.`projectId`
    WHERE c.`projectId` IS NULL;
