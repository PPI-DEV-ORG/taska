-- Metadata Sales Order (ClientPO) dipindah dari JSON di SystemSetting ("client-po:meta:<id>") ke kolom ClientPO.

ALTER TABLE `ClientPO` ADD COLUMN `coaAccount` VARCHAR(191) NULL,
    ADD COLUMN `docMode` VARCHAR(191) NULL,
    ADD COLUMN `goodsDispatched` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `items` JSON NULL,
    ADD COLUMN `paymentProofFileId` INTEGER NULL,
    ADD COLUMN `paymentStatus` VARCHAR(191) NULL,
    ADD COLUMN `poClientNumber` VARCHAR(191) NULL,
    ADD COLUMN `pph` DECIMAL(18, 2) NULL,
    ADD COLUMN `pphMode` VARCHAR(191) NULL,
    ADD COLUMN `ppn` DECIMAL(18, 2) NULL,
    ADD COLUMN `ppnMode` VARCHAR(191) NULL,
    ADD COLUMN `projectId` INTEGER NULL,
    ADD COLUMN `settledAt` DATETIME(3) NULL,
    ADD COLUMN `settlementType` VARCHAR(191) NULL,
    ADD COLUMN `soFileId` INTEGER NULL,
    ADD COLUMN `soNumber` VARCHAR(191) NULL,
    ADD COLUMN `tipePph` VARCHAR(191) NULL,
    ADD COLUMN `tipePpn` VARCHAR(191) NULL;

CREATE INDEX `ClientPO_projectId_idx` ON `ClientPO`(`projectId`);

ALTER TABLE `ClientPO` ADD CONSTRAINT `ClientPO_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Salin data lama (bila ada). Nilai JSON "null" dianggap kosong. "-" dari tampilan lama dianggap kosong.
UPDATE `ClientPO` c
JOIN `SystemSetting` s ON s.`key` = CONCAT('client-po:meta:', c.`id`)
SET
  c.`soNumber`           = NULLIF(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.soNumber')), 'null'), '-'),
  c.`poClientNumber`     = NULLIF(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.poClientNumber')), 'null'), '-'),
  c.`docMode`            = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.docMode')), 'null'),
  c.`soFileId`           = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.soFileId')), 'null') AS SIGNED),
  c.`items`              = JSON_EXTRACT(s.`value`, '$.items'),
  c.`ppn`                = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.ppn')), 'null') AS DECIMAL(18, 2)),
  c.`tipePpn`            = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.tipePpn')), 'null'),
  c.`ppnMode`            = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.ppnMode')), 'null'),
  c.`pph`                = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.pph')), 'null') AS DECIMAL(18, 2)),
  c.`tipePph`            = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.tipePph')), 'null'),
  c.`pphMode`            = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.pphMode')), 'null'),
  c.`paymentStatus`      = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.paymentStatus')), 'null'),
  c.`settlementType`     = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.settlementType')), 'null'),
  c.`paymentProofFileId` = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.paymentProofFileId')), 'null') AS SIGNED),
  c.`coaAccount`         = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.coaAccount')), 'null'),
  c.`settledAt`          = CAST(REPLACE(LEFT(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.settledAt')), 'null'), 19), 'T', ' ') AS DATETIME(3)),
  c.`goodsDispatched`    = IF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.goodsDispatched')) = 'true', 1, 0)
WHERE JSON_VALID(s.`value`);

-- projectId hanya disalin bila project-nya masih ada (menjaga foreign key)
UPDATE `ClientPO` c
JOIN `SystemSetting` s ON s.`key` = CONCAT('client-po:meta:', c.`id`)
JOIN `Project` p ON p.`id` = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.projectId')), 'null') AS SIGNED)
SET c.`projectId` = p.`id`
WHERE JSON_VALID(s.`value`);

-- Hapus sumber lama (termasuk baris yatim milik SO yang sudah dihapus)
DELETE FROM `SystemSetting` WHERE `key` LIKE 'client-po:meta:%';
