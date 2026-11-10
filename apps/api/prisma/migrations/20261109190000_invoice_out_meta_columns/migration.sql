-- Metadata Invoice Keluar dipindah dari JSON di SystemSetting ("invoice:meta:<id>") ke kolom InvoiceOut.
-- Hasilnya: bisa divalidasi & di-query (mis. cari invoice per penawaran lewat indeks, bukan LIKE pada JSON),
-- ikut terhapus bersama invoice-nya, dan tidak ada baris pengaturan yatim.

ALTER TABLE `InvoiceOut` ADD COLUMN `autoSwapLogs` JSON NULL,
    ADD COLUMN `city` VARCHAR(191) NULL,
    ADD COLUMN `coaAccount` VARCHAR(191) NULL,
    ADD COLUMN `customerAddress` TEXT NULL,
    ADD COLUMN `discount` DECIMAL(18, 2) NULL,
    ADD COLUMN `dpAmount` DECIMAL(18, 2) NULL,
    ADD COLUMN `dpLabel` VARCHAR(191) NULL,
    ADD COLUMN `emergencyPrId` INTEGER NULL,
    ADD COLUMN `emergencyPrNumber` VARCHAR(191) NULL,
    ADD COLUMN `intro` TEXT NULL,
    ADD COLUMN `isContinuation` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `items` JSON NULL,
    ADD COLUMN `kopLogoUrl` LONGTEXT NULL,
    ADD COLUMN `kopText` TEXT NULL,
    ADD COLUMN `latestFileId` INTEGER NULL,
    ADD COLUMN `latestFileName` VARCHAR(191) NULL,
    ADD COLUMN `notesList` JSON NULL,
    ADD COLUMN `paidFileId` INTEGER NULL,
    ADD COLUMN `parentInvoiceId` INTEGER NULL,
    ADD COLUMN `pph` DECIMAL(18, 2) NULL,
    ADD COLUMN `pphMode` VARCHAR(191) NULL,
    ADD COLUMN `ppnMode` VARCHAR(191) NULL,
    ADD COLUMN `quotationId` INTEGER NULL,
    ADD COLUMN `signerName` VARCHAR(191) NULL,
    ADD COLUMN `signerTitle` VARCHAR(191) NULL,
    ADD COLUMN `stockConflictFlag` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `stockConflictMessage` TEXT NULL,
    ADD COLUMN `subject` VARCHAR(191) NULL,
    ADD COLUMN `tipePph` VARCHAR(191) NULL,
    ADD COLUMN `tipePpn` VARCHAR(191) NULL;

CREATE INDEX `InvoiceOut_quotationId_idx` ON `InvoiceOut`(`quotationId`);

ALTER TABLE `InvoiceOut` ADD CONSTRAINT `InvoiceOut_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `Quotation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Salin data lama (bila ada). Nilai JSON "null" dianggap kosong.
UPDATE `InvoiceOut` i
JOIN `SystemSetting` s ON s.`key` = CONCAT('invoice:meta:', i.`id`)
SET
  i.`parentInvoiceId`        = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.parentInvoiceId')), 'null') AS SIGNED),
  i.`isContinuation`         = IF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.isContinuation')) = 'true', 1, 0),
  i.`discount`               = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.discount')), 'null') AS DECIMAL(18, 2)),
  i.`dpLabel`                = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.dpLabel')), 'null'),
  i.`dpAmount`               = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.dpAmount')), 'null') AS DECIMAL(18, 2)),
  i.`pph`                    = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.pph')), 'null') AS DECIMAL(18, 2)),
  i.`pphMode`                = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.pphMode')), 'null'),
  i.`tipePph`                = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.tipePph')), 'null'),
  i.`tipePpn`                = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.tipePpn')), 'null'),
  i.`ppnMode`                = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.ppnMode')), 'null'),
  i.`coaAccount`             = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.coaAccount')), 'null'),
  i.`paidFileId`             = CAST(COALESCE(
                                 NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.paidFileId')), 'null'),
                                 NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.paymentFileId')), 'null')
                               ) AS SIGNED),
  i.`subject`                = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.subject')), 'null'),
  i.`intro`                  = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.intro')), 'null'),
  i.`city`                   = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.city')), 'null'),
  i.`kopText`                = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.kopText')), 'null'),
  i.`kopLogoUrl`             = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.kopLogoUrl')), 'null'),
  i.`customerAddress`        = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.customerAddress')), 'null'),
  i.`signerName`             = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.signerName')), 'null'),
  i.`signerTitle`            = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.signerTitle')), 'null'),
  i.`notesList`              = JSON_EXTRACT(s.`value`, '$.notesList'),
  i.`items`                  = JSON_EXTRACT(s.`value`, '$.items'),
  i.`stockConflictFlag`      = IF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.stockConflictFlag')) = 'true', 1, 0),
  i.`stockConflictMessage`   = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.stockConflictMessage')), 'null'),
  i.`autoSwapLogs`           = JSON_EXTRACT(s.`value`, '$.autoSwapLogs'),
  i.`emergencyPrId`          = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.emergencyPrId')), 'null') AS SIGNED),
  i.`emergencyPrNumber`      = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.emergencyPrNumber')), 'null'),
  i.`latestFileId`           = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.latestFileId')), 'null') AS SIGNED),
  i.`latestFileName`         = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.latestFileName')), 'null')
WHERE JSON_VALID(s.`value`);

-- quotationId hanya disalin bila penawarannya masih ada (menjaga foreign key)
UPDATE `InvoiceOut` i
JOIN `SystemSetting` s ON s.`key` = CONCAT('invoice:meta:', i.`id`)
JOIN `Quotation` q ON q.`id` = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.quotationId')), 'null') AS SIGNED)
SET i.`quotationId` = q.`id`
WHERE JSON_VALID(s.`value`);

-- Hapus sumber lama (termasuk baris yatim milik invoice yang sudah dihapus)
DELETE FROM `SystemSetting` WHERE `key` LIKE 'invoice:meta:%';
