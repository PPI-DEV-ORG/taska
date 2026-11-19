-- CreateTable maintenance_categories
CREATE TABLE `maintenance_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `maintenance_categories_code_key`(`code`),
    INDEX `maintenance_categories_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable maintenance_checklists
CREATE TABLE `maintenance_checklists` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `categoryId` INTEGER NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `maintenance_checklists_code_key`(`code`),
    INDEX `maintenance_checklists_categoryId_idx`(`categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable maintenance_checklist_items
CREATE TABLE `maintenance_checklist_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `checklistId` INTEGER NOT NULL,
    `itemText` VARCHAR(191) NOT NULL,
    `standardCondition` VARCHAR(191) NULL,
    `sequence` INTEGER NOT NULL DEFAULT 1,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `maintenance_checklist_items_checklistId_idx`(`checklistId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable maintenance_vendors
CREATE TABLE `maintenance_vendors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `contactPerson` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `specialization` VARCHAR(191) NULL,
    `rating` DECIMAL(3, 1) NULL DEFAULT 5.0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `maintenance_vendors_code_key`(`code`),
    INDEX `maintenance_vendors_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable maintenance_plans
CREATE TABLE `maintenance_plans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `planNumber` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `categoryId` INTEGER NOT NULL,
    `method` VARCHAR(191) NOT NULL DEFAULT 'CALENDAR_BASED',
    `intervalValue` INTEGER NOT NULL DEFAULT 1,
    `intervalUnit` VARCHAR(191) NOT NULL DEFAULT 'MONTHS',
    `checklistId` INTEGER NULL,
    `picUserId` INTEGER NULL,
    `autoGenerate` BOOLEAN NOT NULL DEFAULT true,
    `generationHorizon` VARCHAR(191) NOT NULL DEFAULT 'NEXT_CYCLE',
    `reminderLeadDays` VARCHAR(191) NOT NULL DEFAULT '7,3,1',
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `maintenance_plans_planNumber_key`(`planNumber`),
    INDEX `maintenance_plans_categoryId_idx`(`categoryId`),
    INDEX `maintenance_plans_checklistId_idx`(`checklistId`),
    INDEX `maintenance_plans_picUserId_idx`(`picUserId`),
    INDEX `maintenance_plans_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable maintenance_plan_assets
CREATE TABLE `maintenance_plan_assets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `planId` INTEGER NOT NULL,
    `assetId` INTEGER NOT NULL,
    `lastServiceDate` DATE NULL,
    `lastMeterReading` DECIMAL(18, 2) NULL,
    `nextServiceDate` DATE NULL,
    `nextMeterReading` DECIMAL(18, 2) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `maintenance_plan_assets_planId_idx`(`planId`),
    INDEX `maintenance_plan_assets_assetId_idx`(`assetId`),
    UNIQUE INDEX `maintenance_plan_assets_planId_assetId_key`(`planId`, `assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable maintenance_schedules
CREATE TABLE `maintenance_schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scheduleNumber` VARCHAR(191) NOT NULL,
    `planId` INTEGER NULL,
    `assetId` INTEGER NOT NULL,
    `scheduledDate` DATE NOT NULL,
    `scheduledMeter` DECIMAL(18, 2) NULL,
    `maintenanceType` VARCHAR(191) NOT NULL DEFAULT 'PREVENTIVE',
    `priority` VARCHAR(191) NOT NULL DEFAULT 'MEDIUM',
    `assignedUserId` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'SCHEDULED',
    `rescheduleReason` TEXT NULL,
    `rescheduledFromDate` DATE NULL,
    `rescheduledByUserId` INTEGER NULL,
    `notes` TEXT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `maintenance_schedules_scheduleNumber_key`(`scheduleNumber`),
    INDEX `maintenance_schedules_planId_idx`(`planId`),
    INDEX `maintenance_schedules_assetId_idx`(`assetId`),
    INDEX `maintenance_schedules_scheduledDate_idx`(`scheduledDate`),
    INDEX `maintenance_schedules_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable maintenance_requests
CREATE TABLE `maintenance_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requestNumber` VARCHAR(191) NOT NULL,
    `assetId` INTEGER NOT NULL,
    `reporterUserId` INTEGER NOT NULL,
    `requestDate` DATE NOT NULL,
    `problemDescription` TEXT NOT NULL,
    `urgency` VARCHAR(191) NOT NULL DEFAULT 'MEDIUM',
    `initialInspectionNotes` TEXT NULL,
    `inspectedByUserId` INTEGER NULL,
    `inspectedAt` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `rejectionReason` TEXT NULL,
    `workOrderId` INTEGER NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `maintenance_requests_requestNumber_key`(`requestNumber`),
    INDEX `maintenance_requests_assetId_idx`(`assetId`),
    INDEX `maintenance_requests_reporterUserId_idx`(`reporterUserId`),
    INDEX `maintenance_requests_status_idx`(`status`),
    INDEX `maintenance_requests_workOrderId_idx`(`workOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable maintenance_work_orders
CREATE TABLE `maintenance_work_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workOrderNumber` VARCHAR(191) NOT NULL,
    `assetId` INTEGER NOT NULL,
    `maintenanceType` VARCHAR(191) NOT NULL DEFAULT 'PREVENTIVE',
    `priority` VARCHAR(191) NOT NULL DEFAULT 'MEDIUM',
    `problemDescription` TEXT NOT NULL,
    `workInstruction` TEXT NULL,
    `assignedToUserId` INTEGER NULL,
    `plannedStartDate` DATE NULL,
    `plannedFinishDate` DATE NULL,
    `actualStartDate` DATETIME(3) NULL,
    `actualFinishDate` DATETIME(3) NULL,
    `totalSparePartCost` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `totalLaborCost` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `totalExternalServiceCost` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `totalTransportationCost` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `totalOtherCost` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `totalCost` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `isCapitalized` BOOLEAN NOT NULL DEFAULT false,
    `capitalizationStatus` VARCHAR(191) NULL DEFAULT 'NONE',
    `workResult` TEXT NULL,
    `rootCause` TEXT NULL,
    `correctiveAction` TEXT NULL,
    `verificationNotes` TEXT NULL,
    `verifiedByUserId` INTEGER NULL,
    `verifiedAt` DATETIME(3) NULL,
    `closedByUserId` INTEGER NULL,
    `closedAt` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `requestId` INTEGER NULL,
    `scheduleId` INTEGER NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `maintenance_work_orders_workOrderNumber_key`(`workOrderNumber`),
    INDEX `maintenance_work_orders_assetId_idx`(`assetId`),
    INDEX `maintenance_work_orders_assignedToUserId_idx`(`assignedToUserId`),
    INDEX `maintenance_work_orders_status_idx`(`status`),
    INDEX `maintenance_work_orders_maintenanceType_idx`(`maintenanceType`),
    INDEX `maintenance_work_orders_priority_idx`(`priority`),
    INDEX `maintenance_work_orders_requestId_idx`(`requestId`),
    INDEX `maintenance_work_orders_scheduleId_idx`(`scheduleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable maintenance_work_order_tasks
CREATE TABLE `maintenance_work_order_tasks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workOrderId` INTEGER NOT NULL,
    `taskName` VARCHAR(191) NOT NULL,
    `instruction` TEXT NULL,
    `sequence` INTEGER NOT NULL DEFAULT 1,
    `isCompleted` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NULL,
    `completedByUserId` INTEGER NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `maintenance_work_order_tasks_workOrderId_idx`(`workOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable maintenance_work_order_checklists
CREATE TABLE `maintenance_work_order_checklists` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workOrderId` INTEGER NOT NULL,
    `checklistItemId` INTEGER NULL,
    `itemText` VARCHAR(191) NOT NULL,
    `conditionBefore` VARCHAR(191) NULL,
    `conditionAfter` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PASS',
    `notes` TEXT NULL,
    `checkedByUserId` INTEGER NULL,
    `checkedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `maintenance_work_order_checklists_workOrderId_idx`(`workOrderId`),
    INDEX `maintenance_work_order_checklists_checklistItemId_idx`(`checklistItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable maintenance_materials
CREATE TABLE `maintenance_materials` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workOrderId` INTEGER NOT NULL,
    `productId` INTEGER NULL,
    `sparePartName` VARCHAR(191) NOT NULL,
    `partNumber` VARCHAR(191) NULL,
    `quantity` DECIMAL(12, 2) NOT NULL DEFAULT 1.00,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'PCS',
    `unitCost` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `totalCost` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `source` VARCHAR(191) NOT NULL DEFAULT 'WAREHOUSE',
    `warehouseId` INTEGER NULL,
    `stockMovementId` INTEGER NULL,
    `purchaseRequestId` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'REQUESTED',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `maintenance_materials_workOrderId_idx`(`workOrderId`),
    INDEX `maintenance_materials_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable maintenance_labor
CREATE TABLE `maintenance_labor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workOrderId` INTEGER NOT NULL,
    `technicianUserId` INTEGER NULL,
    `technicianName` VARCHAR(191) NOT NULL,
    `hoursSpent` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
    `hourlyRate` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `laborCost` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `workDescription` TEXT NULL,
    `loggedDate` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `maintenance_labor_workOrderId_idx`(`workOrderId`),
    INDEX `maintenance_labor_technicianUserId_idx`(`technicianUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable maintenance_costs
CREATE TABLE `maintenance_costs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workOrderId` INTEGER NOT NULL,
    `costComponent` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `sourceTransactionType` VARCHAR(191) NOT NULL DEFAULT 'MANUAL',
    `sourceTransactionRef` VARCHAR(191) NULL,
    `journalId` INTEGER NULL,
    `isCapitalized` BOOLEAN NOT NULL DEFAULT false,
    `coaCode` VARCHAR(191) NULL,
    `vendorId` INTEGER NULL,
    `incurredDate` DATE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `maintenance_costs_workOrderId_idx`(`workOrderId`),
    INDEX `maintenance_costs_costComponent_idx`(`costComponent`),
    INDEX `maintenance_costs_vendorId_idx`(`vendorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable maintenance_history
CREATE TABLE `maintenance_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetId` INTEGER NOT NULL,
    `workOrderId` INTEGER NULL,
    `maintenanceDate` DATE NOT NULL,
    `maintenanceType` VARCHAR(191) NOT NULL DEFAULT 'PREVENTIVE',
    `problemDescription` TEXT NOT NULL,
    `rootCause` TEXT NULL,
    `correctiveAction` TEXT NULL,
    `sparePartsSummary` TEXT NULL,
    `technicianOrVendor` VARCHAR(191) NULL,
    `totalCost` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `assetDowntimeHours` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
    `photoBeforeUrl` TEXT NULL,
    `photoAfterUrl` TEXT NULL,
    `finalAssetStatus` VARCHAR(191) NOT NULL DEFAULT 'GOOD',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `maintenance_history_assetId_idx`(`assetId`),
    INDEX `maintenance_history_workOrderId_idx`(`workOrderId`),
    INDEX `maintenance_history_maintenanceDate_idx`(`maintenanceDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable maintenance_downtime
CREATE TABLE `maintenance_downtime` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetId` INTEGER NOT NULL,
    `workOrderId` INTEGER NULL,
    `downtimeStart` DATETIME(3) NOT NULL,
    `downtimeEnd` DATETIME(3) NULL,
    `durationHours` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
    `cause` TEXT NOT NULL,
    `operationalImpact` VARCHAR(191) NULL DEFAULT 'FULL_STOP',
    `status` VARCHAR(191) NOT NULL DEFAULT 'RECORDED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `maintenance_downtime_assetId_idx`(`assetId`),
    INDEX `maintenance_downtime_workOrderId_idx`(`workOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable maintenance_attachments
CREATE TABLE `maintenance_attachments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workOrderId` INTEGER NULL,
    `requestId` INTEGER NULL,
    `fileId` INTEGER NULL,
    `fileUrl` TEXT NOT NULL,
    `documentType` VARCHAR(191) NOT NULL DEFAULT 'REPORT',
    `title` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `uploadedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `maintenance_attachments_workOrderId_idx`(`workOrderId`),
    INDEX `maintenance_attachments_requestId_idx`(`requestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable maintenance_approvals
CREATE TABLE `maintenance_approvals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `referenceType` VARCHAR(191) NOT NULL,
    `referenceId` INTEGER NOT NULL,
    `approverUserId` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `notes` TEXT NULL,
    `actedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `maintenance_approvals_referenceType_referenceId_idx`(`referenceType`, `referenceId`),
    INDEX `maintenance_approvals_approverUserId_idx`(`approverUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable maintenance_notifications
CREATE TABLE `maintenance_notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `recipientUserId` INTEGER NOT NULL,
    `notificationType` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `referenceType` VARCHAR(191) NULL,
    `referenceId` INTEGER NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `maintenance_notifications_recipientUserId_idx`(`recipientUserId`),
    INDEX `maintenance_notifications_isRead_idx`(`isRead`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign Keys
ALTER TABLE `maintenance_checklists` ADD CONSTRAINT `maintenance_checklists_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `maintenance_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `maintenance_checklist_items` ADD CONSTRAINT `maintenance_checklist_items_checklistId_fkey` FOREIGN KEY (`checklistId`) REFERENCES `maintenance_checklists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `maintenance_plans` ADD CONSTRAINT `maintenance_plans_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `maintenance_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `maintenance_plans` ADD CONSTRAINT `maintenance_plans_checklistId_fkey` FOREIGN KEY (`checklistId`) REFERENCES `maintenance_checklists`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `maintenance_plans` ADD CONSTRAINT `maintenance_plans_picUserId_fkey` FOREIGN KEY (`picUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `maintenance_plan_assets` ADD CONSTRAINT `maintenance_plan_assets_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `maintenance_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `maintenance_plan_assets` ADD CONSTRAINT `maintenance_plan_assets_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `fa_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `maintenance_schedules` ADD CONSTRAINT `maintenance_schedules_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `maintenance_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `maintenance_schedules` ADD CONSTRAINT `maintenance_schedules_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `fa_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `maintenance_schedules` ADD CONSTRAINT `maintenance_schedules_assignedUserId_fkey` FOREIGN KEY (`assignedUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `maintenance_requests` ADD CONSTRAINT `maintenance_requests_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `fa_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `maintenance_requests` ADD CONSTRAINT `maintenance_requests_reporterUserId_fkey` FOREIGN KEY (`reporterUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `maintenance_requests` ADD CONSTRAINT `maintenance_requests_inspectedByUserId_fkey` FOREIGN KEY (`inspectedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `maintenance_work_orders` ADD CONSTRAINT `maintenance_work_orders_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `fa_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `maintenance_work_orders` ADD CONSTRAINT `maintenance_work_orders_assignedToUserId_fkey` FOREIGN KEY (`assignedToUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `maintenance_work_orders` ADD CONSTRAINT `maintenance_work_orders_verifiedByUserId_fkey` FOREIGN KEY (`verifiedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `maintenance_work_orders` ADD CONSTRAINT `maintenance_work_orders_closedByUserId_fkey` FOREIGN KEY (`closedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `maintenance_work_orders` ADD CONSTRAINT `maintenance_work_orders_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `maintenance_requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `maintenance_work_orders` ADD CONSTRAINT `maintenance_work_orders_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `maintenance_schedules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `maintenance_work_order_tasks` ADD CONSTRAINT `maintenance_work_order_tasks_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `maintenance_work_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `maintenance_work_order_checklists` ADD CONSTRAINT `maintenance_work_order_checklists_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `maintenance_work_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `maintenance_work_order_checklists` ADD CONSTRAINT `maintenance_work_order_checklists_checklistItemId_fkey` FOREIGN KEY (`checklistItemId`) REFERENCES `maintenance_checklist_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `maintenance_materials` ADD CONSTRAINT `maintenance_materials_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `maintenance_work_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `maintenance_materials` ADD CONSTRAINT `maintenance_materials_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `maintenance_labor` ADD CONSTRAINT `maintenance_labor_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `maintenance_work_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `maintenance_labor` ADD CONSTRAINT `maintenance_labor_technicianUserId_fkey` FOREIGN KEY (`technicianUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `maintenance_costs` ADD CONSTRAINT `maintenance_costs_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `maintenance_work_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `maintenance_costs` ADD CONSTRAINT `maintenance_costs_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `maintenance_vendors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `maintenance_history` ADD CONSTRAINT `maintenance_history_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `fa_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `maintenance_history` ADD CONSTRAINT `maintenance_history_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `maintenance_work_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `maintenance_downtime` ADD CONSTRAINT `maintenance_downtime_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `fa_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `maintenance_downtime` ADD CONSTRAINT `maintenance_downtime_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `maintenance_work_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `maintenance_attachments` ADD CONSTRAINT `maintenance_attachments_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `maintenance_work_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `maintenance_attachments` ADD CONSTRAINT `maintenance_attachments_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `maintenance_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `maintenance_approvals` ADD CONSTRAINT `maintenance_approvals_approverUserId_fkey` FOREIGN KEY (`approverUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `maintenance_notifications` ADD CONSTRAINT `maintenance_notifications_recipientUserId_fkey` FOREIGN KEY (`recipientUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
