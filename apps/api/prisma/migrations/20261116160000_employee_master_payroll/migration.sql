-- Master data karyawan + payroll lengkap (BPJS per program, PPh 21 TER A/B/C, uang makan, bonus & potongan).

-- AlterTable
ALTER TABLE `PayrollSlip` ADD COLUMN `bpjsCompany` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `detail` JSON NULL,
    ADD COLUMN `mealAllowance` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `note` TEXT NULL,
    ADD COLUMN `otherDeduction` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `otherIncome` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `taxBase` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `terCategory` VARCHAR(191) NULL,
    ADD COLUMN `terRate` DECIMAL(6, 3) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `SalaryConfig` ADD COLUMN `bpjsJp` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `bpjsKes` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `bpjsTk` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `mealAllowance` DECIMAL(18, 2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `EmployeeProfile` (
    `userId` INTEGER NOT NULL,
    `employeeNo` VARCHAR(191) NULL,
    `nik` VARCHAR(191) NULL,
    `npwp` VARCHAR(191) NULL,
    `birthPlace` VARCHAR(191) NULL,
    `birthDate` DATE NULL,
    `gender` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `joinDate` DATE NULL,
    `employmentType` VARCHAR(191) NOT NULL DEFAULT 'TETAP',
    `contractEndDate` DATE NULL,
    `bankName` VARCHAR(191) NULL,
    `bankAccountNo` VARCHAR(191) NULL,
    `bankAccountName` VARCHAR(191) NULL,
    `bpjsKesNo` VARCHAR(191) NULL,
    `bpjsTkNo` VARCHAR(191) NULL,
    `emergencyName` VARCHAR(191) NULL,
    `emergencyPhone` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EmployeeProfile_employeeNo_key`(`employeeNo`),
    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EmployeeProfile` ADD CONSTRAINT `EmployeeProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Akun piutang karyawan: potongan gaji untuk cicilan pinjaman / kasbon mengurangi piutang ini
INSERT INTO `CoaAccount` (`code`, `name`, `category`, `normalBalance`, `parentCode`, `isPostable`, `isCash`, `isSystem`, `status`, `createdAt`, `updatedAt`)
SELECT '1108', 'Piutang Karyawan (Pinjaman / Kasbon)', 'Aset Lancar', 'DEBIT',
       (SELECT `code` FROM (SELECT `code` FROM `CoaAccount` WHERE `code` = '1100') AS p),
       true, false, true, 'AKTIF', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM (SELECT `code` FROM `CoaAccount` WHERE `code` = '1108') AS x);

INSERT INTO `AccountMapping` (`key`, `accountCode`, `updatedAt`)
SELECT 'EMPLOYEE_RECEIVABLE', '1108', CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM (SELECT `key` FROM `AccountMapping` WHERE `key` = 'EMPLOYEE_RECEIVABLE') AS x);
