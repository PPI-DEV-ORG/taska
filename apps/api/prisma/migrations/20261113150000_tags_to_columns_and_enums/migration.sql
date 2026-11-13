-- Langkah 2-4 kebersihan data:
--   * Data yang dulu diselipkan sebagai tag teks dipindah ke kolom sendiri:
--       PurchaseRequest.otherNote "[PPN:x]" -> ppnMode, "[ALL_CONSUMABLES]" -> isProjectConsumable
--       PurchaseRequestItem.customName "[PAKAI_HABIS]" -> isConsumable
--       DamageReport.description "[RETUR-...]" -> category, "[PO: ..]" -> supplierPoId, "[DIGANTI: ..]" -> replacementNote
--   * Kolom teks bebas pembelian jadi enum (nilai di luar daftar dinormalkan dulu).
--   * Tabel lama ManualJournal (tidak dipakai kode mana pun) dihapus bila kosong; bila berisi, di-rename jadi backup.

-- ───────────── A. Normalisasi nilai sebelum diubah ke enum ─────────────
UPDATE `PurchaseRequest` SET `procurementSource` = UPPER(TRIM(`procurementSource`)) WHERE `procurementSource` IS NOT NULL;
UPDATE `PurchaseRequest` SET `procurementSource` = 'SUPPLIER'
  WHERE `procurementSource` IS NULL OR `procurementSource` NOT IN ('SUPPLIER', 'RETAIL', 'GUDANG');
UPDATE `PurchaseRequest` SET `paymentMethod` =
  CASE WHEN UPPER(COALESCE(`paymentMethod`, '')) REGEXP 'KAS|TUNAI|CASH' THEN 'KAS' ELSE 'UTANG' END;
UPDATE `PurchaseRequest` SET `paymentStatus` =
  CASE WHEN UPPER(COALESCE(`paymentStatus`, '')) = 'DIBAYAR' OR `status` = 'DIBAYAR' THEN 'DIBAYAR' ELSE 'BELUM_DIBAYAR' END;
UPDATE `SupplierPO` SET `manualStatus` = UPPER(TRIM(`manualStatus`)) WHERE `manualStatus` IS NOT NULL;
UPDATE `SupplierPO` SET `manualStatus` = NULL WHERE `manualStatus` IS NOT NULL AND `manualStatus` NOT IN ('LUNAS', 'SAMPAI_BELUM_LUNAS');
UPDATE `SupplierPO` SET `ppnMode` = LOWER(TRIM(`ppnMode`)) WHERE `ppnMode` IS NOT NULL;
UPDATE `SupplierPO` SET `ppnMode` = NULL WHERE `ppnMode` IS NOT NULL AND `ppnMode` NOT IN ('none', 'exclude', 'include');

-- ───────────── B. Perubahan skema ─────────────
-- AlterTable
ALTER TABLE `ApprovalStep` MODIFY `approverRole` ENUM('SUPER_ADMIN', 'ADMIN', 'BOS', 'SALES', 'PM', 'TEKNISI', 'PROCUREMENT', 'FINANCE', 'GUDANG', 'SE', 'HR') NOT NULL;

-- AlterTable
ALTER TABLE `DamageReport` ADD COLUMN `category` ENUM('KERUSAKAN', 'RETUR_PENJUALAN', 'RETUR_PEMBELIAN') NOT NULL DEFAULT 'KERUSAKAN',
    ADD COLUMN `replacementNote` VARCHAR(191) NULL,
    ADD COLUMN `supplierPoId` INTEGER NULL;

-- AlterTable
ALTER TABLE `Notification` MODIFY `targetRole` ENUM('SUPER_ADMIN', 'ADMIN', 'BOS', 'SALES', 'PM', 'TEKNISI', 'PROCUREMENT', 'FINANCE', 'GUDANG', 'SE', 'HR') NULL;

-- AlterTable
ALTER TABLE `PurchaseRequest` ADD COLUMN `isProjectConsumable` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `ppnMode` ENUM('none', 'exclude', 'include') NOT NULL DEFAULT 'none',
    MODIFY `paymentStatus` ENUM('BELUM_DIBAYAR', 'DIBAYAR') NOT NULL DEFAULT 'BELUM_DIBAYAR',
    MODIFY `procurementSource` ENUM('SUPPLIER', 'RETAIL', 'GUDANG') NOT NULL DEFAULT 'SUPPLIER',
    MODIFY `paymentMethod` ENUM('KAS', 'UTANG') NOT NULL DEFAULT 'UTANG';

-- AlterTable
ALTER TABLE `PurchaseRequestItem` ADD COLUMN `isConsumable` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `SupplierPO` MODIFY `manualStatus` ENUM('LUNAS', 'SAMPAI_BELUM_LUNAS') NULL,
    MODIFY `ppnMode` ENUM('none', 'exclude', 'include') NULL;

-- AlterTable
ALTER TABLE `User` MODIFY `role` ENUM('SUPER_ADMIN', 'ADMIN', 'BOS', 'SALES', 'PM', 'TEKNISI', 'PROCUREMENT', 'FINANCE', 'GUDANG', 'SE', 'HR') NOT NULL;


-- CreateIndex
CREATE INDEX `DamageReport_supplierPoId_idx` ON `DamageReport`(`supplierPoId`);

-- CreateIndex
CREATE INDEX `DamageReport_category_idx` ON `DamageReport`(`category`);

-- AddForeignKey
ALTER TABLE `DamageReport` ADD CONSTRAINT `DamageReport_supplierPoId_fkey` FOREIGN KEY (`supplierPoId`) REFERENCES `SupplierPO`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ───────────── C. Pindahkan isi tag ke kolom, lalu bersihkan teksnya ─────────────
UPDATE `PurchaseRequest` SET `ppnMode` = 'exclude' WHERE `otherNote` LIKE '%[PPN:exclude]%';
UPDATE `PurchaseRequest` SET `ppnMode` = 'include' WHERE `otherNote` LIKE '%[PPN:include]%';
UPDATE `PurchaseRequest` SET `isProjectConsumable` = true WHERE `otherNote` LIKE '%[ALL_CONSUMABLES]%';
UPDATE `PurchaseRequest`
  SET `otherNote` = NULLIF(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(`otherNote`, '\\[(PPN:[a-zA-Z]+|ALL_CONSUMABLES)\\]', ''), ' {2,}', ' ')), '')
  WHERE `otherNote` REGEXP '\\[(PPN:|ALL_CONSUMABLES)';

UPDATE `PurchaseRequestItem`
  SET `isConsumable` = true,
      `customName` = TRIM(REGEXP_REPLACE(`customName`, '\\[(PAKAI_HABIS|CONSUMABLE)\\]', ''))
  WHERE `customName` REGEXP '\\[(PAKAI_HABIS|CONSUMABLE)\\]';
-- Request lama yang semua barangnya pakai-habis juga ditandai di level request
UPDATE `PurchaseRequest` pr SET pr.`isProjectConsumable` = true
  WHERE pr.`projectId` IS NOT NULL
    AND EXISTS (SELECT 1 FROM `PurchaseRequestItem` i WHERE i.`requestId` = pr.`id`)
    AND NOT EXISTS (SELECT 1 FROM `PurchaseRequestItem` i WHERE i.`requestId` = pr.`id` AND i.`isConsumable` = false);

UPDATE `DamageReport` SET `category` = 'RETUR_PEMBELIAN' WHERE `description` LIKE '%[RETUR-PEMBELIAN]%';
UPDATE `DamageReport` SET `category` = 'RETUR_PENJUALAN' WHERE `description` LIKE '%[RETUR-PENJUALAN]%';
UPDATE `DamageReport` d
  JOIN `SupplierPO` po ON TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(d.`description`, '[PO:', -1), ']', 1))
    IN (po.`number`, REPLACE(REPLACE(po.`number`, 'POD/', 'PO/'), 'PO-S/', 'PO/'))
  SET d.`supplierPoId` = po.`id`
  WHERE d.`description` LIKE '%[PO:%' AND d.`supplierPoId` IS NULL;
UPDATE `DamageReport`
  SET `replacementNote` = LEFT(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(`description`, '[DIGANTI:', -1), ']', 1)), 191)
  WHERE `description` LIKE '%[DIGANTI:%';
UPDATE `DamageReport` d
  JOIN `SerialUnit` su ON su.`sn` = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(d.`description`, '[SN:', -1), ']', 1))
  SET d.`serialUnitId` = su.`id`
  WHERE d.`description` LIKE '%[SN:%' AND d.`serialUnitId` IS NULL;
-- Tag dibuang dari deskripsi. Tag PO/SN hanya dibuang bila sudah tersambung ke data aslinya (tidak ada info yang hilang).
UPDATE `DamageReport`
  SET `description` = REGEXP_REPLACE(`description`, '\\[(RETUR-PENJUALAN|RETUR-PEMBELIAN|DIGANTI:[^\\]]*)\\]', '')
  WHERE `description` REGEXP '\\[(RETUR-|DIGANTI:)';
UPDATE `DamageReport` SET `description` = REGEXP_REPLACE(`description`, '\\[PO:[^\\]]*\\]', '')
  WHERE `supplierPoId` IS NOT NULL AND `description` LIKE '%[PO:%';
UPDATE `DamageReport` SET `description` = REGEXP_REPLACE(`description`, '\\[SN:[^\\]]*\\]', '')
  WHERE `serialUnitId` IS NOT NULL AND `description` LIKE '%[SN:%';
UPDATE `DamageReport` SET `description` = COALESCE(NULLIF(TRIM(REGEXP_REPLACE(`description`, ' {2,}', ' ')), ''), '-');

-- ───────────── D. Tabel lama ManualJournal ─────────────
SET @mj = (SELECT COUNT(*) FROM `ManualJournal`);
SET @sql = IF(@mj = 0, 'DROP TABLE `ManualJournal`', 'RENAME TABLE `ManualJournal` TO `_backup_ManualJournal`');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
