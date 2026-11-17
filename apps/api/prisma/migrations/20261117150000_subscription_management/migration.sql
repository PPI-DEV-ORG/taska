-- CreateTable
CREATE TABLE `sub_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `subcategory` VARCHAR(191) NULL,
    `defaultBillingCycle` VARCHAR(191) NOT NULL DEFAULT 'ANNUAL',
    `expenseAccountCode` VARCHAR(191) NOT NULL DEFAULT '6122',
    `prepaidAccountCode` VARCHAR(191) NOT NULL DEFAULT '1401',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sub_categories_code_key`(`code`),
    INDEX `sub_categories_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sub_providers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `website` VARCHAR(191) NULL,
    `supportEmail` VARCHAR(191) NULL,
    `supportPhone` VARCHAR(191) NULL,
    `loginPortalUrl` VARCHAR(191) NULL,
    `accountRepresentative` VARCHAR(191) NULL,
    `isSeeded` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sub_providers_code_key`(`code`),
    INDEX `sub_providers_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sub_subscriptions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscriptionCode` VARCHAR(191) NOT NULL,
    `serviceName` VARCHAR(191) NOT NULL,
    `categoryId` INTEGER NOT NULL,
    `providerId` INTEGER NULL,
    `providerName` VARCHAR(191) NULL,
    `accountIdentifier` VARCHAR(191) NULL,
    `serviceUrl` VARCHAR(191) NULL,
    `subscriptionPlan` VARCHAR(191) NULL,
    `billingCycle` VARCHAR(191) NOT NULL DEFAULT 'ANNUAL',
    `startDate` DATE NOT NULL,
    `expirationDate` DATE NULL,
    `nextRenewalDate` DATE NULL,
    `autoRenewal` BOOLEAN NOT NULL DEFAULT false,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'IDR',
    `cost` DECIMAL(18, 2) NOT NULL,
    `tax` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `originalCurrency` VARCHAR(191) NULL,
    `originalAmount` DECIMAL(18, 2) NULL,
    `exchangeRate` DECIMAL(18, 4) NULL,
    `exchangeRateDate` DATE NULL,
    `idrEquivalent` DECIMAL(18, 2) NULL,
    `mrc` DECIMAL(18, 2) NOT NULL,
    `arc` DECIMAL(18, 2) NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `picUserId` INTEGER NULL,
    `businessPurpose` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `paymentStatus` VARCHAR(191) NOT NULL DEFAULT 'UNPAID',
    `expenseAccountCode` VARCHAR(191) NULL,
    `prepaidAccountCode` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sub_subscriptions_subscriptionCode_key`(`subscriptionCode`),
    INDEX `sub_subscriptions_categoryId_idx`(`categoryId`),
    INDEX `sub_subscriptions_providerId_idx`(`providerId`),
    INDEX `sub_subscriptions_status_idx`(`status`),
    INDEX `sub_subscriptions_paymentStatus_idx`(`paymentStatus`),
    INDEX `sub_subscriptions_nextRenewalDate_idx`(`nextRenewalDate`),
    INDEX `sub_subscriptions_department_idx`(`department`),
    INDEX `sub_subscriptions_picUserId_idx`(`picUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sub_cost_allocations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscriptionId` INTEGER NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `projectId` INTEGER NULL,
    `percentage` DECIMAL(5, 2) NOT NULL,
    `allocatedAmount` DECIMAL(18, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sub_cost_allocations_subscriptionId_idx`(`subscriptionId`),
    INDEX `sub_cost_allocations_department_idx`(`department`),
    INDEX `sub_cost_allocations_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sub_renewal_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `renewalCode` VARCHAR(191) NOT NULL,
    `subscriptionId` INTEGER NOT NULL,
    `previousPeriodStart` DATE NOT NULL,
    `previousPeriodEnd` DATE NOT NULL,
    `newPeriodStart` DATE NOT NULL,
    `newPeriodEnd` DATE NOT NULL,
    `previousCost` DECIMAL(18, 2) NOT NULL,
    `renewalCost` DECIMAL(18, 2) NOT NULL,
    `invoiceNumber` VARCHAR(191) NULL,
    `approvalStatus` VARCHAR(191) NOT NULL DEFAULT 'APPROVED',
    `approvedByUserId` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sub_renewal_history_renewalCode_key`(`renewalCode`),
    INDEX `sub_renewal_history_subscriptionId_idx`(`subscriptionId`),
    INDEX `sub_renewal_history_newPeriodStart_idx`(`newPeriodStart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sub_price_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscriptionId` INTEGER NOT NULL,
    `changeType` VARCHAR(191) NOT NULL,
    `previousPlan` VARCHAR(191) NULL,
    `newPlan` VARCHAR(191) NOT NULL,
    `previousCost` DECIMAL(18, 2) NOT NULL,
    `newCost` DECIMAL(18, 2) NOT NULL,
    `effectiveDate` DATE NOT NULL,
    `changeReason` TEXT NOT NULL,
    `approvedByUserId` INTEGER NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sub_price_history_subscriptionId_idx`(`subscriptionId`),
    INDEX `sub_price_history_changeType_idx`(`changeType`),
    INDEX `sub_price_history_effectiveDate_idx`(`effectiveDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sub_usage_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscriptionId` INTEGER NOT NULL,
    `usersCount` INTEGER NULL,
    `licensesCount` INTEGER NULL,
    `storageCapacity` VARCHAR(191) NULL,
    `serverSpecs` VARCHAR(191) NULL,
    `utilizationStatus` VARCHAR(191) NOT NULL DEFAULT 'OPTIMAL',
    `evaluationNotes` TEXT NULL,
    `lastReviewedDate` DATE NULL,
    `reviewedByUserId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sub_usage_records_subscriptionId_idx`(`subscriptionId`),
    INDEX `sub_usage_records_utilizationStatus_idx`(`utilizationStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sub_payment_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscriptionId` INTEGER NOT NULL,
    `invoiceNumber` VARCHAR(191) NULL,
    `invoiceDate` DATE NULL,
    `dueDate` DATE NULL,
    `paymentDate` DATE NULL,
    `billingPeriod` VARCHAR(191) NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `tax` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'IDR',
    `paymentStatus` VARCHAR(191) NOT NULL DEFAULT 'PAID',
    `financeJournalId` INTEGER NULL,
    `paymentProofUrl` TEXT NULL,
    `notes` TEXT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sub_payment_records_subscriptionId_idx`(`subscriptionId`),
    INDEX `sub_payment_records_paymentDate_idx`(`paymentDate`),
    INDEX `sub_payment_records_paymentStatus_idx`(`paymentStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sub_prepaid_schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscriptionId` INTEGER NOT NULL,
    `periodYear` INTEGER NOT NULL,
    `periodMonth` INTEGER NOT NULL,
    `allocationDate` DATE NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `isPosted` BOOLEAN NOT NULL DEFAULT false,
    `journalNumber` VARCHAR(191) NULL,
    `journalEntryId` INTEGER NULL,
    `postedAt` DATETIME(3) NULL,
    `postedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sub_prepaid_schedules_periodYear_periodMonth_isPosted_idx`(`periodYear`, `periodMonth`, `isPosted`),
    UNIQUE INDEX `sub_prepaid_schedules_subscriptionId_periodYear_periodMonth_key`(`subscriptionId`, `periodYear`, `periodMonth`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sub_billing_schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscriptionId` INTEGER NOT NULL,
    `dueDate` DATE NOT NULL,
    `periodLabel` VARCHAR(191) NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `journalEntryId` INTEGER NULL,
    `confirmedAt` DATETIME(3) NULL,
    `confirmedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sub_billing_schedules_subscriptionId_status_idx`(`subscriptionId`, `status`),
    UNIQUE INDEX `sub_billing_schedules_subscriptionId_dueDate_key`(`subscriptionId`, `dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sub_cancellation_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscriptionId` INTEGER NOT NULL,
    `cancellationCode` VARCHAR(191) NOT NULL,
    `reason` TEXT NOT NULL,
    `requestedByUserId` INTEGER NOT NULL,
    `effectiveCancellationDate` DATE NOT NULL,
    `finalBillingDate` DATE NULL,
    `isDataBackupConfirmed` BOOLEAN NOT NULL DEFAULT false,
    `isServiceMigrationConfirmed` BOOLEAN NOT NULL DEFAULT false,
    `isDnsMigrationConfirmed` BOOLEAN NOT NULL DEFAULT false,
    `isDependencyCheckConfirmed` BOOLEAN NOT NULL DEFAULT false,
    `isHandoverConfirmed` BOOLEAN NOT NULL DEFAULT false,
    `isTerminationConfirmed` BOOLEAN NOT NULL DEFAULT false,
    `approvedByUserId` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `notes` TEXT NULL,
    `approvedAt` DATETIME(3) NULL,
    `executedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sub_cancellation_requests_cancellationCode_key`(`cancellationCode`),
    INDEX `sub_cancellation_requests_subscriptionId_idx`(`subscriptionId`),
    INDEX `sub_cancellation_requests_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sub_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscriptionId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `documentType` VARCHAR(191) NOT NULL,
    `fileUrl` TEXT NOT NULL,
    `fileSize` INTEGER NULL,
    `mimeType` VARCHAR(191) NULL,
    `uploadedByUserId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sub_documents_subscriptionId_idx`(`subscriptionId`),
    INDEX `sub_documents_documentType_idx`(`documentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sub_reminder_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscriptionId` INTEGER NOT NULL,
    `reminderType` VARCHAR(191) NOT NULL,
    `recipientUserId` INTEGER NULL,
    `message` TEXT NOT NULL,
    `channel` VARCHAR(191) NOT NULL DEFAULT 'SYSTEM',
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sub_reminder_logs_subscriptionId_reminderType_sentAt_idx`(`subscriptionId`, `reminderType`, `sentAt`),
    INDEX `sub_reminder_logs_sentAt_idx`(`sentAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sub_subscriptions` ADD CONSTRAINT `sub_subscriptions_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `sub_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sub_subscriptions` ADD CONSTRAINT `sub_subscriptions_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `sub_providers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sub_cost_allocations` ADD CONSTRAINT `sub_cost_allocations_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `sub_subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sub_renewal_history` ADD CONSTRAINT `sub_renewal_history_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `sub_subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sub_price_history` ADD CONSTRAINT `sub_price_history_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `sub_subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sub_usage_records` ADD CONSTRAINT `sub_usage_records_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `sub_subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sub_payment_records` ADD CONSTRAINT `sub_payment_records_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `sub_subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sub_prepaid_schedules` ADD CONSTRAINT `sub_prepaid_schedules_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `sub_subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sub_billing_schedules` ADD CONSTRAINT `sub_billing_schedules_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `sub_subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sub_cancellation_requests` ADD CONSTRAINT `sub_cancellation_requests_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `sub_subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sub_documents` ADD CONSTRAINT `sub_documents_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `sub_subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sub_reminder_logs` ADD CONSTRAINT `sub_reminder_logs_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `sub_subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

