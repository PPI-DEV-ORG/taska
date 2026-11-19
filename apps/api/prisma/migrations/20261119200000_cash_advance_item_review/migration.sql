-- Pemeriksaan Finance per nota petty cash (sah / disesuaikan / ditolak).
ALTER TABLE `CashAdvanceItem`
    ADD COLUMN `status` ENUM('DIAJUKAN', 'SAH', 'DITOLAK') NOT NULL DEFAULT 'DIAJUKAN',
    ADD COLUMN `approvedAmount` DECIMAL(18, 2) NULL,
    ADD COLUMN `rejectReason` TEXT NULL;

-- Laporan yang sudah diverifikasi sebelum fitur ini: semua nota dianggap sah penuh.
UPDATE `CashAdvanceItem` i
    JOIN `CashAdvance` c ON c.`id` = i.`cashAdvanceId`
    SET i.`status` = 'SAH', i.`approvedAmount` = i.`amount`
    WHERE c.`status` = 'SELESAI';
