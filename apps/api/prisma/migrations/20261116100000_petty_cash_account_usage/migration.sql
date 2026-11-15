-- Akun 1107: istilah "uang jalan" diganti "petty cash" (saldo uang perusahaan yang dipegang karyawan).
UPDATE `CoaAccount`
SET `name` = 'Uang Muka Karyawan (Petty Cash)', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `code` = '1107' AND `name` = 'Uang Muka Karyawan (Uang Jalan)';

-- Keterangan jurnal petty cash lama dilengkapi keperluannya: "PC/2026/11/003" → "PC/2026/11/003 untuk Survey PT ABC (Jl. Merdeka)".
-- Idempoten: baris yang sudah memuat "<nomor> untuk" dilewati. JournalLine.memo = VARCHAR(191).
CREATE TEMPORARY TABLE `_pc_usage` AS
SELECT ca.`id`, ca.`number`,
  LEFT(CASE
    WHEN s.`id` IS NOT NULL THEN CONCAT('Survey ', TRIM(CONCAT(COALESCE(ld.`name`, ''),
      CASE WHEN s.`location` IS NOT NULL AND TRIM(s.`location`) <> '' THEN CONCAT(' (', TRIM(s.`location`), ')') ELSE '' END)))
    WHEN p.`id` IS NOT NULL THEN CONCAT('Proyek ', TRIM(p.`name`))
    WHEN dn.`id` IS NOT NULL THEN CONCAT('Pengiriman ', dn.`number`)
    WHEN ca.`description` LIKE 'Isi saldo petty cash%' OR ca.`description` LIKE 'Pengembalian saldo petty cash%' THEN NULL
    ELSE NULLIF(TRIM(ca.`description`), '')
  END, 70) AS `usageLabel`
FROM `CashAdvance` ca
LEFT JOIN `Survey` s ON s.`id` = ca.`surveyId`
LEFT JOIN `Lead` ld ON ld.`id` = s.`leadId`
LEFT JOIN `Project` p ON p.`id` = ca.`projectId`
LEFT JOIN `DeliveryNote` dn ON dn.`id` = ca.`deliveryNoteId`;

UPDATE `JournalLine` jl
JOIN `JournalEntry` je ON je.`id` = jl.`entryId`
JOIN `_pc_usage` u ON je.`sourceType` = 'CashAdvance' AND je.`sourceId` = u.`id`
SET jl.`memo` = LEFT(REPLACE(jl.`memo`, u.`number`, CONCAT(u.`number`, ' untuk ', u.`usageLabel`)), 191)
WHERE u.`usageLabel` IS NOT NULL
  AND jl.`memo` LIKE CONCAT('%', u.`number`, '%')
  AND jl.`memo` NOT LIKE CONCAT('%', u.`number`, ' untuk %');

UPDATE `JournalEntry` je
JOIN `_pc_usage` u ON je.`sourceType` = 'CashAdvance' AND je.`sourceId` = u.`id`
SET je.`memo` = REPLACE(je.`memo`, u.`number`, CONCAT(u.`number`, ' untuk ', u.`usageLabel`))
WHERE u.`usageLabel` IS NOT NULL
  AND je.`memo` LIKE CONCAT('%', u.`number`, '%')
  AND je.`memo` NOT LIKE CONCAT('%', u.`number`, ' untuk %');

DROP TEMPORARY TABLE `_pc_usage`;

-- Pemakaian saldo petty cash lewat Pengeluaran (sumber PETTY_CASH): "EXP-012" → "EXP-012 untuk Proyek ...".
CREATE TEMPORARY TABLE `_exp_usage` AS
SELECT e.`id`, CONVERT(CONCAT('EXP-', LPAD(e.`id`, 3, '0')) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS `code`,
  LEFT(CASE
    WHEN s.`id` IS NOT NULL THEN CONCAT('Survey ', TRIM(CONCAT(COALESCE(ld.`name`, ''),
      CASE WHEN s.`location` IS NOT NULL AND TRIM(s.`location`) <> '' THEN CONCAT(' (', TRIM(s.`location`), ')') ELSE '' END)))
    WHEN p.`id` IS NOT NULL THEN CONCAT('Proyek ', TRIM(p.`name`))
    WHEN dn.`id` IS NOT NULL THEN CONCAT('Pengiriman ', dn.`number`)
    ELSE NULL
  END, 70) COLLATE utf8mb4_unicode_ci AS `usageLabel`
FROM `Expense` e
LEFT JOIN `Survey` s ON s.`id` = e.`surveyId`
LEFT JOIN `Lead` ld ON ld.`id` = s.`leadId`
LEFT JOIN `Project` p ON p.`id` = e.`projectId`
LEFT JOIN `DeliveryNote` dn ON dn.`id` = e.`deliveryNoteId`
WHERE e.`fundingSource` = 'PETTY_CASH';

UPDATE `JournalLine` jl
JOIN `JournalEntry` je ON je.`id` = jl.`entryId`
JOIN `_exp_usage` u ON je.`sourceType` = 'Expense' AND je.`sourceId` = u.`id`
SET jl.`memo` = LEFT(REPLACE(jl.`memo`, u.`code`, CONCAT(u.`code`, ' untuk ', u.`usageLabel`)), 191)
WHERE u.`usageLabel` IS NOT NULL
  AND jl.`memo` LIKE CONCAT('%', u.`code`, '%')
  AND jl.`memo` NOT LIKE CONCAT('%', u.`code`, ' untuk %');

DROP TEMPORARY TABLE `_exp_usage`;
