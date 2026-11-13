-- 1) Proforma invoice: InvoiceOut.isProforma + proformaId (invoice resmi hasil konversi dari proforma).
--    Proforma tidak dijurnal, tidak masuk piutang, dan tidak bisa dibayar langsung.
-- 2) Status bayar project: tambah LUNAS_SEBAGIAN (mis. DP sudah dibayar, pelunasan belum).
-- 3) Uang jalan (CashAdvance + CashAdvanceItem) + Expense.cashAdvanceId.
-- 4) Akun COA 1107 "Uang Muka Karyawan (Uang Jalan)" + mapping EMPLOYEE_ADVANCE.
-- (Baris MODIFY enum Role/HR menyamakan urutan enum yang sempat drift; nilainya tidak berubah.)

-- AlterTable
ALTER TABLE `ApprovalStep` MODIFY `approverRole` ENUM('SUPER_ADMIN', 'ADMIN', 'BOS', 'SALES', 'PM', 'TEKNISI', 'PROCUREMENT', 'FINANCE', 'GUDANG', 'SE', 'HR') NOT NULL;

-- AlterTable
ALTER TABLE `Expense` ADD COLUMN `cashAdvanceId` INTEGER NULL;

-- AlterTable
ALTER TABLE `InvoiceOut` ADD COLUMN `isProforma` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `proformaId` INTEGER NULL;

-- AlterTable
ALTER TABLE `Notification` MODIFY `targetRole` ENUM('SUPER_ADMIN', 'ADMIN', 'BOS', 'SALES', 'PM', 'TEKNISI', 'PROCUREMENT', 'FINANCE', 'GUDANG', 'SE', 'HR') NULL;

-- AlterTable
ALTER TABLE `Project` MODIFY `paymentStatus` ENUM('BELUM_LUNAS', 'LUNAS_SEBAGIAN', 'LUNAS') NOT NULL DEFAULT 'BELUM_LUNAS';

-- AlterTable
ALTER TABLE `User` MODIFY `role` ENUM('SUPER_ADMIN', 'ADMIN', 'BOS', 'SALES', 'PM', 'TEKNISI', 'PROCUREMENT', 'FINANCE', 'GUDANG', 'SE', 'HR') NOT NULL;

-- CreateTable
CREATE TABLE `CashAdvance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(191) NOT NULL,
    `purpose` ENUM('SURVEY', 'PENGIRIMAN', 'PROJECT', 'LAINNYA') NOT NULL DEFAULT 'LAINNYA',
    `description` TEXT NOT NULL,
    `surveyId` INTEGER NULL,
    `deliveryNoteId` INTEGER NULL,
    `projectId` INTEGER NULL,
    `employeeId` INTEGER NOT NULL,
    `requestedById` INTEGER NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `neededDate` DATE NULL,
    `status` ENUM('DIAJUKAN', 'DISETUJUI', 'DITOLAK', 'DICAIRKAN', 'DILAPORKAN', 'SELESAI', 'DIBATALKAN') NOT NULL DEFAULT 'DIAJUKAN',
    `approvedAmount` DECIMAL(18, 2) NULL,
    `approvedById` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectReason` TEXT NULL,
    `disbursedAmount` DECIMAL(18, 2) NULL,
    `disbursedAt` DATE NULL,
    `disburseAccountCode` VARCHAR(191) NULL,
    `disburseMethod` VARCHAR(191) NULL,
    `disburseFileId` INTEGER NULL,
    `disbursedById` INTEGER NULL,
    `reportedAt` DATETIME(3) NULL,
    `reportNote` TEXT NULL,
    `settledAt` DATETIME(3) NULL,
    `settledById` INTEGER NULL,
    `spentAmount` DECIMAL(18, 2) NULL,
    `returnedAmount` DECIMAL(18, 2) NULL,
    `returnAccountCode` VARCHAR(191) NULL,
    `returnFileId` INTEGER NULL,
    `reimbursedAmount` DECIMAL(18, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CashAdvance_number_key`(`number`),
    INDEX `CashAdvance_status_idx`(`status`),
    INDEX `CashAdvance_employeeId_idx`(`employeeId`),
    INDEX `CashAdvance_surveyId_idx`(`surveyId`),
    INDEX `CashAdvance_deliveryNoteId_idx`(`deliveryNoteId`),
    INDEX `CashAdvance_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CashAdvanceItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cashAdvanceId` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `categoryId` INTEGER NULL,
    `receiptFileIds` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CashAdvanceItem_cashAdvanceId_idx`(`cashAdvanceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Expense_cashAdvanceId_idx` ON `Expense`(`cashAdvanceId`);

-- CreateIndex
CREATE UNIQUE INDEX `InvoiceOut_proformaId_key` ON `InvoiceOut`(`proformaId`);

-- CreateIndex
CREATE INDEX `InvoiceOut_isProforma_idx` ON `InvoiceOut`(`isProforma`);

-- AddForeignKey
ALTER TABLE `InvoiceOut` ADD CONSTRAINT `InvoiceOut_proformaId_fkey` FOREIGN KEY (`proformaId`) REFERENCES `InvoiceOut`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_cashAdvanceId_fkey` FOREIGN KEY (`cashAdvanceId`) REFERENCES `CashAdvance`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashAdvance` ADD CONSTRAINT `CashAdvance_surveyId_fkey` FOREIGN KEY (`surveyId`) REFERENCES `Survey`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashAdvance` ADD CONSTRAINT `CashAdvance_deliveryNoteId_fkey` FOREIGN KEY (`deliveryNoteId`) REFERENCES `DeliveryNote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashAdvance` ADD CONSTRAINT `CashAdvance_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashAdvance` ADD CONSTRAINT `CashAdvance_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashAdvance` ADD CONSTRAINT `CashAdvance_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashAdvance` ADD CONSTRAINT `CashAdvance_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashAdvance` ADD CONSTRAINT `CashAdvance_disburseFileId_fkey` FOREIGN KEY (`disburseFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashAdvance` ADD CONSTRAINT `CashAdvance_disbursedById_fkey` FOREIGN KEY (`disbursedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashAdvance` ADD CONSTRAINT `CashAdvance_settledById_fkey` FOREIGN KEY (`settledById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashAdvance` ADD CONSTRAINT `CashAdvance_returnFileId_fkey` FOREIGN KEY (`returnFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashAdvanceItem` ADD CONSTRAINT `CashAdvanceItem_cashAdvanceId_fkey` FOREIGN KEY (`cashAdvanceId`) REFERENCES `CashAdvance`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashAdvanceItem` ADD CONSTRAINT `CashAdvanceItem_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ExpenseCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- ───────────── Akun & mapping uang jalan ─────────────
INSERT INTO `CoaAccount` (`code`, `name`, `category`, `normalBalance`, `parentCode`, `isPostable`, `isCash`, `isSystem`, `status`, `createdAt`, `updatedAt`)
SELECT '1107', 'Uang Muka Karyawan (Uang Jalan)', 'Aset Lancar', 'DEBIT',
       (SELECT `code` FROM (SELECT `code` FROM `CoaAccount` WHERE `code` = '1100') AS p),
       true, false, true, 'AKTIF', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM (SELECT `code` FROM `CoaAccount` WHERE `code` = '1107') AS x);

INSERT INTO `AccountMapping` (`key`, `accountCode`, `updatedAt`)
SELECT 'EMPLOYEE_ADVANCE', '1107', CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM (SELECT `key` FROM `AccountMapping` WHERE `key` = 'EMPLOYEE_ADVANCE') AS x);
