-- Hilangkan duplikasi data di sisi penjualan (metadata invoice keluar & Sales Order).
-- Sumber tunggal: total/ppn invoice = kolom InvoiceOut; total SO = amount + ppn - pph; nama project = relasi Project.

-- 1) Item invoice yang dulu disimpan di key terpisah "invoice.items.<id>" dipindah ke "invoice:meta:<id>".items
UPDATE `SystemSetting` m
JOIN `SystemSetting` i ON i.`key` = CONCAT('invoice.items.', SUBSTRING(m.`key`, 14))
SET m.`value` = JSON_SET(m.`value`, '$.items', CAST(i.`value` AS JSON))
WHERE m.`key` LIKE 'invoice:meta:%'
  AND JSON_VALID(m.`value`)
  AND JSON_VALID(i.`value`)
  AND JSON_EXTRACT(m.`value`, '$.items') IS NULL;

-- 2) Invoice yang hanya punya "invoice.items.<id>" (tanpa metadata) dibuatkan metadata-nya
INSERT INTO `SystemSetting` (`key`, `value`, `updatedAt`)
SELECT CONCAT('invoice:meta:', SUBSTRING(i.`key`, 15)), JSON_OBJECT('items', CAST(i.`value` AS JSON)), NOW(3)
FROM `SystemSetting` i
WHERE i.`key` LIKE 'invoice.items.%'
  AND JSON_VALID(i.`value`)
  AND NOT EXISTS (
    SELECT 1 FROM (SELECT `key` FROM `SystemSetting`) m
    WHERE m.`key` = CONCAT('invoice:meta:', SUBSTRING(i.`key`, 15))
  );

-- 3) Buang salinan total/ppn di metadata invoice (kolom InvoiceOut yang berlaku) dan total/projectName di metadata SO
UPDATE `SystemSetting`
SET `value` = JSON_REMOVE(`value`, '$.total', '$.ppn')
WHERE `key` LIKE 'invoice:meta:%' AND JSON_VALID(`value`);

UPDATE `SystemSetting`
SET `value` = JSON_REMOVE(`value`, '$.total', '$.projectName')
WHERE `key` LIKE 'client-po:meta:%' AND JSON_VALID(`value`);

-- 4) Hapus key kembar (invoice.meta.<id> tidak pernah dibaca; invoice.items.<id> sudah dipindah)
DELETE FROM `SystemSetting` WHERE `key` LIKE 'invoice.meta.%' OR `key` LIKE 'invoice.items.%';
