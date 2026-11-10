-- Metadata Invoice Masuk dipindah dari JSON di SystemSetting ("invoice-in:meta:<id>") ke kolom InvoiceIn.
-- Berkas (fileId / transferFileId) sudah kolom sendiri; salinannya di metadata tidak dipertahankan.

ALTER TABLE `InvoiceIn` ADD COLUMN `category` VARCHAR(191) NULL,
    ADD COLUMN `coaAccount` VARCHAR(191) NULL,
    ADD COLUMN `date` DATE NULL,
    ADD COLUMN `debitAccount` VARCHAR(191) NULL,
    ADD COLUMN `items` JSON NULL,
    ADD COLUMN `notes` TEXT NULL,
    ADD COLUMN `pph` DECIMAL(18, 2) NULL,
    ADD COLUMN `pphMode` VARCHAR(191) NULL,
    ADD COLUMN `tipePph` VARCHAR(191) NULL;

-- Salin data lama (bila ada). Nilai JSON "null" dianggap kosong.
UPDATE `InvoiceIn` i
JOIN `SystemSetting` s ON s.`key` = CONCAT('invoice-in:meta:', i.`id`)
SET
  i.`notes`        = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.notes')), 'null'),
  i.`category`     = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.category')), 'null'),
  i.`debitAccount` = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.debitAccount')), 'null'),
  i.`date`         = STR_TO_DATE(LEFT(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.date')), 'null'), 10), '%Y-%m-%d'),
  i.`items`        = JSON_EXTRACT(s.`value`, '$.items'),
  i.`coaAccount`   = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.coaAccount')), 'null'),
  i.`pph`          = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.pph')), 'null') AS DECIMAL(18, 2)),
  i.`pphMode`      = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.pphMode')), 'null'),
  i.`tipePph`      = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.tipePph')), 'null'),
  -- berkas: kolom yang berlaku; metadata hanya dipakai bila kolomnya kosong (data lama)
  i.`fileId`         = COALESCE(i.`fileId`, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.fileId')), 'null') AS SIGNED)),
  i.`transferFileId` = COALESCE(
                         i.`transferFileId`,
                         CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.transferFileId')), 'null') AS SIGNED),
                         CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.paymentFileId')), 'null') AS SIGNED)
                       )
WHERE JSON_VALID(s.`value`);

-- Hapus sumber lama (termasuk baris yatim milik invoice masuk yang sudah dihapus)
DELETE FROM `SystemSetting` WHERE `key` LIKE 'invoice-in:meta:%';
