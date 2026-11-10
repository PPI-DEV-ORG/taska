-- Jatuh tempo pembayaran untuk request barang (pembelian tempo/utang).
-- Kolom sudah ada di schema.prisma tetapi belum pernah dibuatkan migrasinya.
ALTER TABLE `PurchaseRequest` ADD COLUMN `dueDate` DATE NULL;

CREATE INDEX `PurchaseRequest_dueDate_idx` ON `PurchaseRequest`(`dueDate`);
