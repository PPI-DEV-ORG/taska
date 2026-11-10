-- Metadata Penawaran dipindah dari JSON di SystemSetting ("quotation.meta.<id>") ke kolom Quotation.
-- Metadata ini dibaca lewat key mentah oleh banyak servis (leads, invoice, Sales Order, project); setelah ini
-- semuanya membaca baris Quotation.

ALTER TABLE `Quotation` ADD COLUMN `autoSwapLogs` JSON NULL,
    ADD COLUMN `city` VARCHAR(191) NULL,
    ADD COLUMN `customerAddress` TEXT NULL,
    ADD COLUMN `emergencyPrId` INTEGER NULL,
    ADD COLUMN `emergencyPrNumber` VARCHAR(191) NULL,
    ADD COLUMN `intro` TEXT NULL,
    ADD COLUMN `items` JSON NULL,
    ADD COLUMN `kopText` TEXT NULL,
    ADD COLUMN `latestFileId` INTEGER NULL,
    ADD COLUMN `latestFileName` VARCHAR(191) NULL,
    ADD COLUMN `notes` JSON NULL,
    ADD COLUMN `pph` DECIMAL(18, 2) NULL,
    ADD COLUMN `pphMode` VARCHAR(191) NULL,
    ADD COLUMN `signerName` VARCHAR(191) NULL,
    ADD COLUMN `signerTitle` VARCHAR(191) NULL,
    ADD COLUMN `stockConflictFlag` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `stockConflictMessage` TEXT NULL,
    ADD COLUMN `subject` VARCHAR(191) NULL,
    ADD COLUMN `tipePph` VARCHAR(191) NULL;

-- Salin data lama (bila ada). Nilai JSON "null" dianggap kosong.
UPDATE `Quotation` q
JOIN `SystemSetting` s ON s.`key` = CONCAT('quotation.meta.', q.`id`)
SET
  q.`items`                = JSON_EXTRACT(s.`value`, '$.items'),
  q.`subject`              = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.subject')), 'null'),
  q.`intro`                = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.intro')), 'null'),
  q.`notes`                = JSON_EXTRACT(s.`value`, '$.notes'),
  q.`city`                 = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.city')), 'null'),
  q.`kopText`              = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.kopText')), 'null'),
  q.`customerAddress`      = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.customerAddress')), 'null'),
  q.`signerName`           = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.signerName')), 'null'),
  q.`signerTitle`          = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.signerTitle')), 'null'),
  q.`pph`                  = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.pph')), 'null') AS DECIMAL(18, 2)),
  q.`pphMode`              = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.pphMode')), 'null'),
  q.`tipePph`              = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.tipePph')), 'null'),
  q.`latestFileId`         = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.latestFileId')), 'null') AS SIGNED),
  q.`latestFileName`       = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.latestFileName')), 'null'),
  q.`stockConflictFlag`    = IF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.stockConflictFlag')) = 'true', 1, 0),
  q.`stockConflictMessage` = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.stockConflictMessage')), 'null'),
  q.`autoSwapLogs`         = JSON_EXTRACT(s.`value`, '$.autoSwapLogs'),
  q.`emergencyPrId`        = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.emergencyPrId')), 'null') AS SIGNED),
  q.`emergencyPrNumber`    = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.emergencyPrNumber')), 'null')
WHERE JSON_VALID(s.`value`);

-- Hapus sumber lama (termasuk baris yatim milik penawaran yang sudah dihapus, dan varian key "quotation:meta:")
DELETE FROM `SystemSetting` WHERE `key` LIKE 'quotation.meta.%' OR `key` LIKE 'quotation:meta:%';
