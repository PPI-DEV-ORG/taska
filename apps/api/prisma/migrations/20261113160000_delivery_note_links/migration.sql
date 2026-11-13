-- Surat jalan: kaitan ke Sales Order (ClientPO) & Invoice disimpan sebagai kolom + foreign key.
-- Dulu ditulis sebagai tag teks "[so:id]", "[inv:id]", "[invNum:nomor]" di alasan / laporan surat jalan
-- lalu dibaca ulang dengan regex di beberapa tempat. Tag dipindah ke kolom lalu dibuang dari teks.

-- AlterTable
ALTER TABLE `ApprovalStep` MODIFY `approverRole` ENUM('SUPER_ADMIN', 'ADMIN', 'BOS', 'SALES', 'PM', 'TEKNISI', 'PROCUREMENT', 'FINANCE', 'GUDANG', 'SE', 'HR') NOT NULL;

-- AlterTable
ALTER TABLE `DeliveryNote` ADD COLUMN `clientPoId` INTEGER NULL,
    ADD COLUMN `invoiceId` INTEGER NULL;

-- AlterTable
ALTER TABLE `Notification` MODIFY `targetRole` ENUM('SUPER_ADMIN', 'ADMIN', 'BOS', 'SALES', 'PM', 'TEKNISI', 'PROCUREMENT', 'FINANCE', 'GUDANG', 'SE', 'HR') NULL;

-- AlterTable
ALTER TABLE `User` MODIFY `role` ENUM('SUPER_ADMIN', 'ADMIN', 'BOS', 'SALES', 'PM', 'TEKNISI', 'PROCUREMENT', 'FINANCE', 'GUDANG', 'SE', 'HR') NOT NULL;

-- CreateIndex
CREATE INDEX `DeliveryNote_clientPoId_idx` ON `DeliveryNote`(`clientPoId`);

-- CreateIndex
CREATE INDEX `DeliveryNote_invoiceId_idx` ON `DeliveryNote`(`invoiceId`);

-- AddForeignKey
ALTER TABLE `DeliveryNote` ADD CONSTRAINT `DeliveryNote_clientPoId_fkey` FOREIGN KEY (`clientPoId`) REFERENCES `ClientPO`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryNote` ADD CONSTRAINT `DeliveryNote_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `InvoiceOut`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ───────────── Pindahkan tag ke kolom ─────────────
UPDATE `DeliveryNote` dn
  JOIN `DeliveryNoteLocation` l ON l.`deliveryNoteId` = dn.`id`
  JOIN `ClientPO` c ON c.`id` = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(l.`reason`, '[so:', -1), ']', 1) AS UNSIGNED)
  SET dn.`clientPoId` = c.`id`
  WHERE dn.`clientPoId` IS NULL AND l.`reason` LIKE '%[so:%';
UPDATE `DeliveryNote` dn
  JOIN `ClientPO` c ON c.`id` = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(dn.`reportText`, '[so:', -1), ']', 1) AS UNSIGNED)
  SET dn.`clientPoId` = c.`id`
  WHERE dn.`clientPoId` IS NULL AND dn.`reportText` LIKE '%[so:%';

UPDATE `DeliveryNote` dn
  JOIN `DeliveryNoteLocation` l ON l.`deliveryNoteId` = dn.`id`
  JOIN `InvoiceOut` i ON i.`id` = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(l.`reason`, '[inv:', -1), ']', 1) AS UNSIGNED)
  SET dn.`invoiceId` = i.`id`
  WHERE dn.`invoiceId` IS NULL AND l.`reason` LIKE '%[inv:%';
UPDATE `DeliveryNote` dn
  JOIN `InvoiceOut` i ON i.`id` = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(dn.`reportText`, '[inv:', -1), ']', 1) AS UNSIGNED)
  SET dn.`invoiceId` = i.`id`
  WHERE dn.`invoiceId` IS NULL AND dn.`reportText` LIKE '%[inv:%';
UPDATE `DeliveryNote` dn
  JOIN `DeliveryNoteLocation` l ON l.`deliveryNoteId` = dn.`id`
  JOIN `InvoiceOut` i ON i.`number` = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(l.`reason`, '[invNum:', -1), ']', 1))
  SET dn.`invoiceId` = i.`id`
  WHERE dn.`invoiceId` IS NULL AND l.`reason` LIKE '%[invNum:%';

-- Invoice yang terhubung ke SO melengkapi kaitan SO bila belum ada
UPDATE `DeliveryNote` dn JOIN `InvoiceOut` i ON i.`id` = dn.`invoiceId`
  SET dn.`clientPoId` = i.`clientPoId`
  WHERE dn.`clientPoId` IS NULL AND i.`clientPoId` IS NOT NULL;

-- ───────────── Bersihkan tag dari teks (hanya yang sudah tersambung) ─────────────
UPDATE `DeliveryNoteLocation` l JOIN `DeliveryNote` dn ON dn.`id` = l.`deliveryNoteId`
  SET l.`reason` = COALESCE(NULLIF(TRIM(REGEXP_REPLACE(l.`reason`, '\\s*\\[(so|soNum):[^\\]]*\\]', '')), ''), 'Pengiriman barang')
  WHERE dn.`clientPoId` IS NOT NULL AND l.`reason` REGEXP '\\[(so|soNum):';
UPDATE `DeliveryNoteLocation` l JOIN `DeliveryNote` dn ON dn.`id` = l.`deliveryNoteId`
  SET l.`reason` = COALESCE(NULLIF(TRIM(REGEXP_REPLACE(l.`reason`, '\\s*\\[(inv|invNum):[^\\]]*\\]', '')), ''), 'Pengiriman barang')
  WHERE dn.`invoiceId` IS NOT NULL AND l.`reason` REGEXP '\\[(inv|invNum):';
UPDATE `DeliveryNote`
  SET `reportText` = NULLIF(TRIM(REGEXP_REPLACE(`reportText`, '\\s*\\[(so|soNum):[^\\]]*\\]', '')), '')
  WHERE `clientPoId` IS NOT NULL AND `reportText` REGEXP '\\[(so|soNum):';
UPDATE `DeliveryNote`
  SET `reportText` = NULLIF(TRIM(REGEXP_REPLACE(`reportText`, '\\s*\\[(inv|invNum):[^\\]]*\\]', '')), '')
  WHERE `invoiceId` IS NOT NULL AND `reportText` REGEXP '\\[(inv|invNum):';
