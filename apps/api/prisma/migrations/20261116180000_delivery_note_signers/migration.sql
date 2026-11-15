-- Surat jalan: pengirim (karyawan / ekspedisi + no. kendaraan), gudang asal & petugas gudang yang TTD,
-- dan penerima di lokasi (surat jalan project = PM project).
ALTER TABLE `DeliveryNote` ADD COLUMN `recipientName` VARCHAR(191) NULL,
    ADD COLUMN `recipientPhone` VARCHAR(191) NULL,
    ADD COLUMN `recipientTitle` VARCHAR(191) NULL,
    ADD COLUMN `recipientUserId` INTEGER NULL,
    ADD COLUMN `senderId` INTEGER NULL,
    ADD COLUMN `senderName` VARCHAR(191) NULL,
    ADD COLUMN `vehicleNo` VARCHAR(191) NULL,
    ADD COLUMN `warehouseId` INTEGER NULL,
    ADD COLUMN `warehouseStaffId` INTEGER NULL;

CREATE INDEX `DeliveryNote_recipientUserId_idx` ON `DeliveryNote`(`recipientUserId`);

ALTER TABLE `DeliveryNote` ADD CONSTRAINT `DeliveryNote_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DeliveryNote` ADD CONSTRAINT `DeliveryNote_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DeliveryNote` ADD CONSTRAINT `DeliveryNote_warehouseStaffId_fkey` FOREIGN KEY (`warehouseStaffId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DeliveryNote` ADD CONSTRAINT `DeliveryNote_recipientUserId_fkey` FOREIGN KEY (`recipientUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Data lama: pengirim = pembuat surat jalan
UPDATE `DeliveryNote` SET `senderId` = `creatorId` WHERE `senderId` IS NULL AND `senderName` IS NULL;

-- Data lama: gudang asal dari mutasi stok surat jalan
UPDATE `DeliveryNote` dn
JOIN (SELECT `deliveryNoteId`, MIN(`fromWarehouseId`) AS `wh` FROM `StockMovement` WHERE `deliveryNoteId` IS NOT NULL AND `fromWarehouseId` IS NOT NULL GROUP BY `deliveryNoteId`) m
  ON m.`deliveryNoteId` = dn.`id`
SET dn.`warehouseId` = m.`wh`
WHERE dn.`warehouseId` IS NULL;

-- Data lama: surat jalan project → penerima PM project
UPDATE `DeliveryNote` dn
JOIN (SELECT `deliveryNoteId`, MIN(`projectId`) AS `pid` FROM `DeliveryNoteLocation` WHERE `projectId` IS NOT NULL GROUP BY `deliveryNoteId`) l
  ON l.`deliveryNoteId` = dn.`id`
JOIN `Project` p ON p.`id` = l.`pid`
JOIN `User` u ON u.`id` = p.`picId`
SET dn.`recipientUserId` = u.`id`, dn.`recipientName` = u.`name`, dn.`recipientTitle` = 'Project Manager', dn.`recipientPhone` = u.`phone`
WHERE dn.`recipientUserId` IS NULL AND dn.`recipientName` IS NULL;
