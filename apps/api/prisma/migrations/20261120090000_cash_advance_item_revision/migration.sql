-- Nota petty cash bisa dikembalikan ke karyawan untuk direvisi.
ALTER TABLE `CashAdvanceItem` MODIFY `status` ENUM('DIAJUKAN', 'SAH', 'DITOLAK', 'REVISI') NOT NULL DEFAULT 'DIAJUKAN';
