-- Faktur pajak (e-Faktur) & nomor seri faktur pajak (NSFP) pada tagihan supplier,
-- dasar mengkreditkan PPN Masukan.
ALTER TABLE `InvoiceIn` ADD COLUMN `taxInvoiceFileId` INTEGER NULL,
    ADD COLUMN `taxInvoiceNumber` VARCHAR(191) NULL;

ALTER TABLE `InvoiceIn` ADD CONSTRAINT `InvoiceIn_taxInvoiceFileId_fkey` FOREIGN KEY (`taxInvoiceFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
