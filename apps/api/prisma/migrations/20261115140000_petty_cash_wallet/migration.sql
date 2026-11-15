-- Petty cash sebagai saldo per karyawan:
--   ISI_SALDO   = Finance mengisi saldo petty cash karyawan langsung (Dr Uang Muka Karyawan, Cr Kas)
--   TARIK_SALDO = sisa saldo dikembalikan karyawan ke kas (Dr Kas, Cr Uang Muka Karyawan)
-- Pemakaian saldo dicatat sebagai Expense dengan fundingSource 'PETTY_CASH' (kolom teks, tanpa perubahan skema).
ALTER TABLE `CashAdvance` MODIFY `purpose` ENUM('SURVEY', 'PENGIRIMAN', 'PROJECT', 'LAINNYA', 'ISI_SALDO', 'TARIK_SALDO') NOT NULL DEFAULT 'LAINNYA';
