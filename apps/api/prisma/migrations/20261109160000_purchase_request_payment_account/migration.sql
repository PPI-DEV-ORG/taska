-- Satukan informasi pembayaran request barang.
-- Sebelumnya status bayar tersebar di: kolom paymentStatus, status DIBAYAR, bukti bayar, dan tag "[DIBAYAR...]"
-- yang disisipkan di depan otherNote (satu-satunya tempat sumber dana disimpan).
-- Sekarang: paymentStatus = status bayar, paymentAccountCode = akun kas/bank. Tag di otherNote dihapus.

ALTER TABLE `PurchaseRequest` ADD COLUMN `paymentAccountCode` VARCHAR(191) NULL;

-- 1) Pindahkan akun kas/bank dari tag "[DIBAYAR:<kode>] ..." ke kolom baru
UPDATE `PurchaseRequest`
SET `paymentAccountCode` = SUBSTRING(`otherNote`, 10, LOCATE(']', `otherNote`) - 10)
WHERE `otherNote` LIKE '[DIBAYAR:%]%';

-- 2) Semua sinyal "sudah dibayar" lama dilebur ke paymentStatus
UPDATE `PurchaseRequest`
SET `paymentStatus` = 'DIBAYAR'
WHERE `status` = 'DIBAYAR'
   OR `paymentProofFileId` IS NOT NULL
   OR `otherNote` LIKE '%[DIBAYAR%';

-- 3) Buang tag dari catatan
UPDATE `PurchaseRequest`
SET `otherNote` = NULLIF(TRIM(SUBSTRING(`otherNote`, LOCATE(']', `otherNote`) + 1)), '')
WHERE `otherNote` LIKE '[DIBAYAR:%]%';

UPDATE `PurchaseRequest`
SET `otherNote` = NULLIF(TRIM(SUBSTRING(`otherNote`, 10)), '')
WHERE `otherNote` LIKE '[DIBAYAR]%';
