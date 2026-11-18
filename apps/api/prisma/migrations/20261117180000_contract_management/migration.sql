-- CreateTable
CREATE TABLE `contract_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `contract_types_code_key`(`code`),
    INDEX `contract_types_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contracts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractNumber` VARCHAR(191) NOT NULL,
    `officialNumber` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `typeId` INTEGER NOT NULL,
    `counterpartyType` VARCHAR(191) NOT NULL DEFAULT 'VENDOR',
    `counterpartyId` INTEGER NULL,
    `counterpartyName` VARCHAR(191) NOT NULL,
    `effectiveDate` DATE NOT NULL,
    `expirationDate` DATE NOT NULL,
    `renewalDate` DATE NULL,
    `isAutoRenewal` BOOLEAN NOT NULL DEFAULT false,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'IDR',
    `contractValue` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `contractOwnerId` INTEGER NULL,
    `department` VARCHAR(191) NOT NULL,
    `paymentTerms` VARCHAR(191) NULL,
    `paymentFrequency` VARCHAR(191) NOT NULL DEFAULT 'ONE_TIME',
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `approvalStatus` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `description` TEXT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `contracts_contractNumber_key`(`contractNumber`),
    INDEX `contracts_typeId_idx`(`typeId`),
    INDEX `contracts_counterpartyType_counterpartyId_idx`(`counterpartyType`, `counterpartyId`),
    INDEX `contracts_status_idx`(`status`),
    INDEX `contracts_approvalStatus_idx`(`approvalStatus`),
    INDEX `contracts_expirationDate_idx`(`expirationDate`),
    INDEX `contracts_renewalDate_idx`(`renewalDate`),
    INDEX `contracts_department_idx`(`department`),
    INDEX `contracts_contractOwnerId_idx`(`contractOwnerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_parties` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `partyType` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL DEFAULT 'OTHER',
    `entityId` INTEGER NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `picName` VARCHAR(191) NULL,
    `picEmail` VARCHAR(191) NULL,
    `picPhone` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `contract_parties_contractId_idx`(`contractId`),
    INDEX `contract_parties_entityType_entityId_idx`(`entityType`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `documentCategory` VARCHAR(191) NOT NULL,
    `documentTitle` VARCHAR(191) NOT NULL,
    `documentNumber` VARCHAR(191) NULL,
    `isConfidential` BOOLEAN NOT NULL DEFAULT false,
    `signedDate` DATE NULL,
    `signedByFirstParty` VARCHAR(191) NULL,
    `signedBySecondParty` VARCHAR(191) NULL,
    `currentVersionNumber` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `contract_documents_contractId_idx`(`contractId`),
    INDEX `contract_documents_documentCategory_idx`(`documentCategory`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_document_versions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `documentId` INTEGER NOT NULL,
    `versionNumber` INTEGER NOT NULL DEFAULT 1,
    `fileId` INTEGER NULL,
    `fileUrl` VARCHAR(500) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NULL,
    `mimeType` VARCHAR(191) NULL,
    `changeSummary` TEXT NULL,
    `isLockedForApproval` BOOLEAN NOT NULL DEFAULT false,
    `uploadedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `contract_document_versions_documentId_versionNumber_idx`(`documentId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_services` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `serviceName` VARCHAR(191) NOT NULL,
    `serviceScope` TEXT NULL,
    `servicePeriod` VARCHAR(191) NULL,
    `serviceLocation` VARCHAR(191) NULL,
    `supportContact` VARCHAR(191) NULL,
    `serviceFee` DECIMAL(18, 2) NULL,
    `penaltyClause` TEXT NULL,
    `renewalTerms` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `contract_services_contractId_idx`(`contractId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_sla` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `serviceId` INTEGER NULL,
    `indicatorName` VARCHAR(191) NOT NULL,
    `targetMetric` VARCHAR(191) NOT NULL,
    `responseHours` DECIMAL(6, 2) NULL,
    `resolutionHours` DECIMAL(6, 2) NULL,
    `penaltyDetails` TEXT NULL,
    `operationalHours` VARCHAR(191) NULL DEFAULT '8x5',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `contract_sla_contractId_idx`(`contractId`),
    INDEX `contract_sla_serviceId_idx`(`serviceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_terms` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `termType` VARCHAR(191) NOT NULL,
    `clauseNumber` VARCHAR(50) NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `contract_terms_contractId_idx`(`contractId`),
    INDEX `contract_terms_termType_idx`(`termType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_financials` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `valueType` VARCHAR(191) NOT NULL DEFAULT 'FIXED',
    `currency` VARCHAR(191) NOT NULL DEFAULT 'IDR',
    `baseAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `taxPercentage` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `taxAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `totalAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `downPaymentAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `retentionAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `retentionPeriodDays` INTEGER NULL,
    `penaltyTerms` TEXT NULL,
    `costCenter` VARCHAR(191) NULL,
    `projectReference` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `contract_financials_contractId_key`(`contractId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_payment_schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `scheduleNumber` INTEGER NOT NULL DEFAULT 1,
    `milestoneName` VARCHAR(191) NOT NULL,
    `dueDate` DATE NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `taxAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `totalAmount` DECIMAL(18, 2) NOT NULL,
    `paymentStatus` VARCHAR(191) NOT NULL DEFAULT 'PLANNED',
    `invoiceReference` VARCHAR(191) NULL,
    `paidDate` DATE NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `contract_payment_schedules_contractId_idx`(`contractId`),
    INDEX `contract_payment_schedules_dueDate_idx`(`dueDate`),
    INDEX `contract_payment_schedules_paymentStatus_idx`(`paymentStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_renewals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `renewalNumber` INTEGER NOT NULL DEFAULT 1,
    `renewalCode` VARCHAR(191) NOT NULL,
    `submissionDate` DATE NOT NULL,
    `proposedEffectiveDate` DATE NOT NULL,
    `proposedExpirationDate` DATE NOT NULL,
    `previousValue` DECIMAL(18, 2) NOT NULL,
    `proposedValue` DECIMAL(18, 2) NOT NULL,
    `reason` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING_REVIEW',
    `submittedById` INTEGER NULL,
    `reviewedById` INTEGER NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewComments` TEXT NULL,
    `draftAddendumDocId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `contract_renewals_renewalCode_key`(`renewalCode`),
    INDEX `contract_renewals_contractId_idx`(`contractId`),
    INDEX `contract_renewals_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_approvals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `stage` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL DEFAULT 1,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `approverId` INTEGER NULL,
    `approverRole` VARCHAR(191) NULL,
    `decisionTimestamp` DATETIME(3) NULL,
    `comments` TEXT NULL,
    `approvedDocumentVersionId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `contract_approvals_contractId_idx`(`contractId`),
    INDEX `contract_approvals_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_expiration_rules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `typeId` INTEGER NULL,
    `daysOffset` INTEGER NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `targetRole` VARCHAR(191) NULL,
    `notifyOwner` BOOLEAN NOT NULL DEFAULT true,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `contract_expiration_rules_typeId_idx`(`typeId`),
    INDEX `contract_expiration_rules_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `notificationType` VARCHAR(191) NOT NULL,
    `triggerPeriod` VARCHAR(191) NULL,
    `recipientUserId` INTEGER NULL,
    `channel` VARCHAR(191) NOT NULL DEFAULT 'IN_APP',
    `message` TEXT NOT NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deliveryStatus` VARCHAR(191) NOT NULL DEFAULT 'DELIVERED',
    `calendarEventId` INTEGER NULL,

    INDEX `contract_notifications_contractId_notificationType_idx`(`contractId`, `notificationType`),
    INDEX `contract_notifications_sentAt_idx`(`sentAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_amendments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `amendmentNumber` VARCHAR(191) NOT NULL,
    `amendmentDate` DATE NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `valueAdjustment` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `newEffectiveDate` DATE NULL,
    `newExpirationDate` DATE NULL,
    `documentId` INTEGER NULL,
    `approvedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `contract_amendments_contractId_idx`(`contractId`),
    INDEX `contract_amendments_amendmentDate_idx`(`amendmentDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_terminations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `terminationDate` DATE NOT NULL,
    `reason` TEXT NOT NULL,
    `penaltyAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `remainingObligations` TEXT NULL,
    `checklistConfirmed` BOOLEAN NOT NULL DEFAULT false,
    `beritaAcaraDocId` INTEGER NULL,
    `approvedById` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'APPROVED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `contract_terminations_contractId_key`(`contractId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_relations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `relatedModule` VARCHAR(191) NOT NULL,
    `relatedId` INTEGER NOT NULL,
    `referenceCode` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `contract_relations_contractId_idx`(`contractId`),
    INDEX `contract_relations_relatedModule_relatedId_idx`(`relatedModule`, `relatedId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `userId` INTEGER NULL,
    `userName` VARCHAR(191) NULL,
    `fieldChanged` VARCHAR(191) NULL,
    `oldValue` TEXT NULL,
    `newValue` TEXT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `contract_audit_logs_contractId_idx`(`contractId`),
    INDEX `contract_audit_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `contracts` ADD CONSTRAINT `contracts_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `contract_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_parties` ADD CONSTRAINT `contract_parties_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_documents` ADD CONSTRAINT `contract_documents_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_document_versions` ADD CONSTRAINT `contract_document_versions_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `contract_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_services` ADD CONSTRAINT `contract_services_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_sla` ADD CONSTRAINT `contract_sla_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_sla` ADD CONSTRAINT `contract_sla_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `contract_services`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_terms` ADD CONSTRAINT `contract_terms_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_financials` ADD CONSTRAINT `contract_financials_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_payment_schedules` ADD CONSTRAINT `contract_payment_schedules_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_renewals` ADD CONSTRAINT `contract_renewals_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_approvals` ADD CONSTRAINT `contract_approvals_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_approvals` ADD CONSTRAINT `contract_approvals_approvedDocumentVersionId_fkey` FOREIGN KEY (`approvedDocumentVersionId`) REFERENCES `contract_document_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_expiration_rules` ADD CONSTRAINT `contract_expiration_rules_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `contract_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_notifications` ADD CONSTRAINT `contract_notifications_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_amendments` ADD CONSTRAINT `contract_amendments_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_terminations` ADD CONSTRAINT `contract_terminations_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_relations` ADD CONSTRAINT `contract_relations_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_audit_logs` ADD CONSTRAINT `contract_audit_logs_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
