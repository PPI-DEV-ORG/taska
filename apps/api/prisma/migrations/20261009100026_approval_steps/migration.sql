/*
  Warnings:

  - You are about to drop the column `bosAt` on the `Approval` table. All the data in the column will be lost.
  - You are about to drop the column `bosById` on the `Approval` table. All the data in the column will be lost.
  - You are about to drop the column `bosOk` on the `Approval` table. All the data in the column will be lost.
  - You are about to drop the column `financeAt` on the `Approval` table. All the data in the column will be lost.
  - You are about to drop the column `financeById` on the `Approval` table. All the data in the column will be lost.
  - You are about to drop the column `financeOk` on the `Approval` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `Approval` DROP FOREIGN KEY `Approval_bosById_fkey`;

-- DropForeignKey
ALTER TABLE `Approval` DROP FOREIGN KEY `Approval_financeById_fkey`;

-- DropIndex
DROP INDEX `Approval_bosById_fkey` ON `Approval`;

-- DropIndex
DROP INDEX `Approval_financeById_fkey` ON `Approval`;

-- AlterTable
ALTER TABLE `Approval` DROP COLUMN `bosAt`,
    DROP COLUMN `bosById`,
    DROP COLUMN `bosOk`,
    DROP COLUMN `financeAt`,
    DROP COLUMN `financeById`,
    DROP COLUMN `financeOk`;

-- CreateTable
CREATE TABLE `ApprovalStep` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `approvalId` INTEGER NOT NULL,
    `approverRole` ENUM('ADMIN', 'BOS', 'SALES', 'PM', 'TEKNISI', 'PROCUREMENT', 'FINANCE', 'GUDANG', 'SE') NOT NULL,
    `status` ENUM('MENUNGGU', 'DISETUJUI', 'DITOLAK') NOT NULL DEFAULT 'MENUNGGU',
    `decidedById` INTEGER NULL,
    `decidedAt` DATETIME(3) NULL,
    `reason` VARCHAR(191) NULL,

    INDEX `ApprovalStep_approverRole_status_idx`(`approverRole`, `status`),
    UNIQUE INDEX `ApprovalStep_approvalId_approverRole_key`(`approvalId`, `approverRole`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ApprovalStep` ADD CONSTRAINT `ApprovalStep_approvalId_fkey` FOREIGN KEY (`approvalId`) REFERENCES `Approval`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
