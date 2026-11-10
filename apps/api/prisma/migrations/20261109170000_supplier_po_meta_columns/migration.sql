-- Metadata PO supplier dipindah dari JSON di SystemSetting ("supplier-po:meta:<id>") ke kolom SupplierPO,
-- supaya bisa divalidasi, di-query, dan ikut terhapus bersama PO-nya.

ALTER TABLE `SupplierPO`
  ADD COLUMN `supplierSoNumber` VARCHAR(191) NULL,
  ADD COLUMN `soFileId` INT NULL,
  ADD COLUMN `manualStatus` VARCHAR(191) NULL,
  ADD COLUMN `ppnMode` VARCHAR(191) NULL,
  ADD COLUMN `dpp` DECIMAL(18, 2) NULL,
  ADD COLUMN `ppn` DECIMAL(18, 2) NULL,
  ADD COLUMN `pphMode` VARCHAR(191) NULL,
  ADD COLUMN `tipePph` VARCHAR(191) NULL,
  ADD COLUMN `pph` DECIMAL(18, 2) NULL;

-- Salin data lama (bila ada)
UPDATE `SupplierPO` p
JOIN `SystemSetting` s ON s.`key` = CONCAT('supplier-po:meta:', p.`id`)
SET
  p.`supplierSoNumber` = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.supplierSoNumber')), 'null'),
  p.`soFileId`         = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.soFileId')), 'null') AS SIGNED),
  p.`manualStatus`     = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.manualStatus')), 'null'),
  p.`ppnMode`          = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.ppnMode')), 'null'),
  p.`dpp`              = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.dpp')), 'null') AS DECIMAL(18, 2)),
  p.`ppn`              = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.ppn')), 'null') AS DECIMAL(18, 2)),
  p.`pphMode`          = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.pphMode')), 'null'),
  p.`tipePph`          = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.tipePph')), 'null'),
  p.`pph`              = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.`value`, '$.pph')), 'null') AS DECIMAL(18, 2))
WHERE JSON_VALID(s.`value`);

-- Hapus sumber lama (termasuk baris yatim milik PO yang sudah dihapus)
DELETE FROM `SystemSetting` WHERE `key` LIKE 'supplier-po:meta:%';
