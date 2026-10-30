-- Migrasi penambahan status DIBAYAR dan field pembayaran serta relasi Penerimaan ke Request Barang
ALTER TABLE `PurchaseRequest` 
  MODIFY COLUMN `status` ENUM('DIAJUKAN', 'CEK_STOK', 'DISETUJUI', 'DIBAYAR', 'DITOLAK', 'PO_DIBUAT', 'DIKIRIM', 'DITERIMA', 'DIBATALKAN') NOT NULL DEFAULT 'DIAJUKAN',
  ADD COLUMN `paymentProofFileId` INT NULL,
  ADD COLUMN `paymentStatus` VARCHAR(191) NULL DEFAULT 'BELUM_DIBAYAR';

ALTER TABLE `Receiving`
  ADD COLUMN `requestId` INT NULL,
  ADD CONSTRAINT `Receiving_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `PurchaseRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX `Receiving_requestId_idx` ON `Receiving`(`requestId`);

