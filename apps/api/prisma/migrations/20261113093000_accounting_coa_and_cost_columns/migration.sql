-- MySQL tidak mendukung `ADD COLUMN IF NOT EXISTS`. Susun ALTER TABLE
-- hanya dari kolom yang benar-benar belum ada di database saat ini.

-- ExpenseCategory
SET @sql = (
  SELECT CONCAT('ALTER TABLE `ExpenseCategory` ', GROUP_CONCAT(CONCAT('ADD COLUMN `', c.name, '` ', c.def) ORDER BY c.name SEPARATOR ', '))
  FROM (
    SELECT 'coaAccount' AS name, 'VARCHAR(191) NULL' AS def
  ) c
  LEFT JOIN information_schema.COLUMNS col
    ON col.TABLE_SCHEMA = DATABASE()
   AND col.TABLE_NAME = 'ExpenseCategory'
   AND col.COLUMN_NAME = c.name
  WHERE col.COLUMN_NAME IS NULL
);
SET @sql = IFNULL(@sql, 'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Product
SET @sql = (
  SELECT CONCAT('ALTER TABLE `Product` ', GROUP_CONCAT(CONCAT('ADD COLUMN `', c.name, '` ', c.def) ORDER BY c.name SEPARATOR ', '))
  FROM (
    SELECT 'avgCost' AS name, 'DECIMAL(18, 4) NOT NULL DEFAULT 0' AS def
  ) c
  LEFT JOIN information_schema.COLUMNS col
    ON col.TABLE_SCHEMA = DATABASE()
   AND col.TABLE_NAME = 'Product'
   AND col.COLUMN_NAME = c.name
  WHERE col.COLUMN_NAME IS NULL
);
SET @sql = IFNULL(@sql, 'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- InvoiceOut
SET @sql = (
  SELECT CONCAT('ALTER TABLE `InvoiceOut` ', GROUP_CONCAT(CONCAT('ADD COLUMN `', c.name, '` ', c.def) ORDER BY c.name SEPARATOR ', '))
  FROM (
    SELECT 'dpApplied' AS name, 'DECIMAL(18, 2) NOT NULL DEFAULT 0' AS def
    UNION ALL SELECT 'retentionPercent' AS name, 'DECIMAL(5, 2) NULL' AS def
    UNION ALL SELECT 'retentionAmount' AS name, 'DECIMAL(18, 2) NULL' AS def
  ) c
  LEFT JOIN information_schema.COLUMNS col
    ON col.TABLE_SCHEMA = DATABASE()
   AND col.TABLE_NAME = 'InvoiceOut'
   AND col.COLUMN_NAME = c.name
  WHERE col.COLUMN_NAME IS NULL
);
SET @sql = IFNULL(@sql, 'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Payment
SET @sql = (
  SELECT CONCAT('ALTER TABLE `Payment` ', GROUP_CONCAT(CONCAT('ADD COLUMN `', c.name, '` ', c.def) ORDER BY c.name SEPARATOR ', '))
  FROM (
    SELECT 'accountCode' AS name, 'VARCHAR(191) NULL' AS def
  ) c
  LEFT JOIN information_schema.COLUMNS col
    ON col.TABLE_SCHEMA = DATABASE()
   AND col.TABLE_NAME = 'Payment'
   AND col.COLUMN_NAME = c.name
  WHERE col.COLUMN_NAME IS NULL
);
SET @sql = IFNULL(@sql, 'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Expense
SET @sql = (
  SELECT CONCAT('ALTER TABLE `Expense` ', GROUP_CONCAT(CONCAT('ADD COLUMN `', c.name, '` ', c.def) ORDER BY c.name SEPARATOR ', '))
  FROM (
    SELECT 'paidAccountCode' AS name, 'VARCHAR(191) NULL' AS def
  ) c
  LEFT JOIN information_schema.COLUMNS col
    ON col.TABLE_SCHEMA = DATABASE()
   AND col.TABLE_NAME = 'Expense'
   AND col.COLUMN_NAME = c.name
  WHERE col.COLUMN_NAME IS NULL
);
SET @sql = IFNULL(@sql, 'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- StockMovement
SET @sql = (
  SELECT CONCAT('ALTER TABLE `StockMovement` ', GROUP_CONCAT(CONCAT('ADD COLUMN `', c.name, '` ', c.def) ORDER BY c.name SEPARATOR ', '))
  FROM (
    SELECT 'unitCost' AS name, 'DECIMAL(18, 4) NULL' AS def
    UNION ALL SELECT 'totalCost' AS name, 'DECIMAL(18, 2) NULL' AS def
  ) c
  LEFT JOIN information_schema.COLUMNS col
    ON col.TABLE_SCHEMA = DATABASE()
   AND col.TABLE_NAME = 'StockMovement'
   AND col.COLUMN_NAME = c.name
  WHERE col.COLUMN_NAME IS NULL
);
SET @sql = IFNULL(@sql, 'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- PayrollSlip
SET @sql = (
  SELECT CONCAT('ALTER TABLE `PayrollSlip` ', GROUP_CONCAT(CONCAT('ADD COLUMN `', c.name, '` ', c.def) ORDER BY c.name SEPARATOR ', '))
  FROM (
    SELECT 'paidAccountCode' AS name, 'VARCHAR(191) NULL' AS def
  ) c
  LEFT JOIN information_schema.COLUMNS col
    ON col.TABLE_SCHEMA = DATABASE()
   AND col.TABLE_NAME = 'PayrollSlip'
   AND col.COLUMN_NAME = c.name
  WHERE col.COLUMN_NAME IS NULL
);
SET @sql = IFNULL(@sql, 'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- CoaAccount
SET @sql = (
  SELECT CONCAT('ALTER TABLE `CoaAccount` ', GROUP_CONCAT(CONCAT('ADD COLUMN `', c.name, '` ', c.def) ORDER BY c.name SEPARATOR ', '))
  FROM (
    SELECT 'isPostable' AS name, 'BOOLEAN NOT NULL DEFAULT true' AS def
    UNION ALL SELECT 'isCash' AS name, 'BOOLEAN NOT NULL DEFAULT false' AS def
    UNION ALL SELECT 'isSystem' AS name, 'BOOLEAN NOT NULL DEFAULT false' AS def
  ) c
  LEFT JOIN information_schema.COLUMNS col
    ON col.TABLE_SCHEMA = DATABASE()
   AND col.TABLE_NAME = 'CoaAccount'
   AND col.COLUMN_NAME = c.name
  WHERE col.COLUMN_NAME IS NULL
);
SET @sql = IFNULL(@sql, 'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- CreateTable: AccountingPeriod
CREATE TABLE IF NOT EXISTS `AccountingPeriod` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `status` ENUM('OPEN', 'REQUESTED_CLOSE', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `requestedAt` DATETIME(3) NULL,
    `requestedById` INTEGER NULL,
    `closedAt` DATETIME(3) NULL,
    `closedById` INTEGER NULL,
    `reopenedAt` DATETIME(3) NULL,
    `reopenedById` INTEGER NULL,
    `note` VARCHAR(191) NULL,
    `reopenReason` VARCHAR(191) NULL,

    UNIQUE INDEX `AccountingPeriod_year_month_key`(`year`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: FiscalYear
CREATE TABLE IF NOT EXISTS `FiscalYear` (
    `year` INTEGER NOT NULL,
    `status` ENUM('OPEN', 'REQUESTED_CLOSE', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `closingEntryId` INTEGER NULL,
    `closedAt` DATETIME(3) NULL,
    `closedById` INTEGER NULL,
    `reopenedAt` DATETIME(3) NULL,
    `reopenedById` INTEGER NULL,
    `reopenReason` VARCHAR(191) NULL,

    UNIQUE INDEX `FiscalYear_closingEntryId_key`(`closingEntryId`),
    PRIMARY KEY (`year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: JournalEntry
CREATE TABLE IF NOT EXISTS `JournalEntry` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `sourceType` VARCHAR(191) NULL,
    `sourceId` INTEGER NULL,
    `event` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `memo` TEXT NOT NULL,
    `refNo` VARCHAR(191) NULL,
    `projectId` INTEGER NULL,
    `status` ENUM('POSTED', 'REVERSED') NOT NULL DEFAULT 'POSTED',
    `reversalOfId` INTEGER NULL,
    `periodId` INTEGER NOT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `JournalEntry_number_key`(`number`),
    UNIQUE INDEX `JournalEntry_reversalOfId_key`(`reversalOfId`),
    INDEX `JournalEntry_date_idx`(`date`),
    INDEX `JournalEntry_source_idx`(`source`),
    INDEX `JournalEntry_projectId_idx`(`projectId`),
    INDEX `JournalEntry_periodId_idx`(`periodId`),
    UNIQUE INDEX `JournalEntry_sourceType_sourceId_event_version_key`(`sourceType`, `sourceId`, `event`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: JournalLine
CREATE TABLE IF NOT EXISTS `JournalLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `entryId` INTEGER NOT NULL,
    `lineNo` INTEGER NOT NULL,
    `accountCode` VARCHAR(191) NOT NULL,
    `debit` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `credit` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `memo` VARCHAR(191) NULL,
    `projectId` INTEGER NULL,
    `partyType` VARCHAR(191) NULL,
    `partyId` INTEGER NULL,

    INDEX `JournalLine_entryId_idx`(`entryId`),
    INDEX `JournalLine_accountCode_idx`(`accountCode`),
    INDEX `JournalLine_projectId_idx`(`projectId`),
    INDEX `JournalLine_partyType_partyId_idx`(`partyType`, `partyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: AccountMapping
CREATE TABLE IF NOT EXISTS `AccountMapping` (
    `key` VARCHAR(191) NOT NULL,
    `accountCode` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: ManualJournal
CREATE TABLE IF NOT EXISTS `ManualJournal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `journalNo` VARCHAR(191) NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `refNo` VARCHAR(191) NULL,
    `description` TEXT NOT NULL,
    `project` VARCHAR(191) NULL,
    `lines` LONGTEXT NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ManualJournal_journalNo_key`(`journalNo`),
    INDEX `ManualJournal_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- DropTable: RolePermission
DROP TABLE IF EXISTS `RolePermission`;

-- AddForeignKeys
ALTER TABLE `JournalEntry` ADD CONSTRAINT `JournalEntry_reversalOfId_fkey` FOREIGN KEY (`reversalOfId`) REFERENCES `JournalEntry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `JournalEntry` ADD CONSTRAINT `JournalEntry_periodId_fkey` FOREIGN KEY (`periodId`) REFERENCES `AccountingPeriod`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `JournalLine` ADD CONSTRAINT `JournalLine_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `JournalEntry`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `JournalLine` ADD CONSTRAINT `JournalLine_accountCode_fkey` FOREIGN KEY (`accountCode`) REFERENCES `CoaAccount`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `AccountMapping` ADD CONSTRAINT `AccountMapping_accountCode_fkey` FOREIGN KEY (`accountCode`) REFERENCES `CoaAccount`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;
