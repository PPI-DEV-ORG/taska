-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `position` VARCHAR(191) NULL,
    `department` VARCHAR(191) NULL,
    `role` ENUM('ADMIN', 'BOS', 'SALES', 'PM', 'TEKNISI', 'PROCUREMENT', 'FINANCE', 'GUDANG', 'SE') NOT NULL,
    `status` ENUM('AKTIF', 'NONAKTIF') NOT NULL DEFAULT 'AKTIF',
    `warehouseId` INTEGER NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_role_status_idx`(`role`, `status`),
    INDEX `User_warehouseId_idx`(`warehouseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefreshToken` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tokenHash` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `userAgent` VARCHAR(191) NULL,
    `ip` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RefreshToken_tokenHash_key`(`tokenHash`),
    INDEX `RefreshToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `File` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `path` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `kind` ENUM('FOTO', 'DOKUMEN', 'VIDEO', 'LAINNYA') NOT NULL DEFAULT 'LAINNYA',
    `refType` VARCHAR(191) NULL,
    `refId` VARCHAR(191) NULL,
    `uploadedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `File_refType_refId_idx`(`refType`, `refId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actorId` INTEGER NULL,
    `actorName` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `detail` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NULL,

    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `AuditLog_actorId_idx`(`actorId`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `targetRole` ENUM('ADMIN', 'BOS', 'SALES', 'PM', 'TEKNISI', 'PROCUREMENT', 'FINANCE', 'GUDANG', 'SE') NULL,
    `kind` ENUM('APPROVAL', 'STOK', 'PENGIRIMAN', 'LEAD', 'TUGAS', 'SURAT', 'LAINNYA') NOT NULL DEFAULT 'LAINNYA',
    `text` VARCHAR(191) NOT NULL,
    `href` VARCHAR(191) NOT NULL,
    `read` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_read_idx`(`userId`, `read`),
    INDEX `Notification_targetRole_read_idx`(`targetRole`, `read`),
    INDEX `Notification_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentNumber` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `docType` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `seq` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `DocumentNumber_docType_period_key`(`docType`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemSetting` (
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `updatedById` INTEGER NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Approval` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kind` ENUM('PENAWARAN', 'PERMINTAAN_SURVEY', 'PURCHASE_REQUEST', 'SUPPLIER_PO', 'INVOICE_IN', 'PENERIMAAN', 'SURAT_JALAN', 'PENGELUARAN', 'OPNAME') NOT NULL,
    `entityId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `requestedById` INTEGER NOT NULL,
    `status` ENUM('MENUNGGU', 'DISETUJUI', 'DITOLAK') NOT NULL DEFAULT 'MENUNGGU',
    `financeOk` BOOLEAN NOT NULL DEFAULT false,
    `bosOk` BOOLEAN NOT NULL DEFAULT false,
    `financeById` INTEGER NULL,
    `financeAt` DATETIME(3) NULL,
    `bosById` INTEGER NULL,
    `bosAt` DATETIME(3) NULL,
    `reason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Approval_kind_entityId_idx`(`kind`, `entityId`),
    INDEX `Approval_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `company` VARCHAR(191) NULL,
    `pic` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `status` ENUM('AKTIF', 'NONAKTIF') NOT NULL DEFAULT 'AKTIF',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Customer_name_idx`(`name`),
    INDEX `Customer_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Supplier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `pic` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `paymentTerms` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `status` ENUM('AKTIF', 'NONAKTIF') NOT NULL DEFAULT 'AKTIF',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Supplier_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `prefix` VARCHAR(191) NULL,
    `status` ENUM('AKTIF', 'NONAKTIF') NOT NULL DEFAULT 'AKTIF',

    UNIQUE INDEX `ProductCategory_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sku` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NULL,
    `categoryId` INTEGER NULL,
    `unit` VARCHAR(191) NOT NULL,
    `hasSerial` BOOLEAN NOT NULL DEFAULT false,
    `minStock` INTEGER NOT NULL DEFAULT 0,
    `warrantyMonths` INTEGER NULL,
    `purchasePrice` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `status` ENUM('AKTIF', 'NONAKTIF') NOT NULL DEFAULT 'AKTIF',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Product_sku_key`(`sku`),
    INDEX `Product_name_idx`(`name`),
    INDEX `Product_categoryId_idx`(`categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Warehouse` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NULL,
    `status` ENUM('AKTIF', 'NONAKTIF') NOT NULL DEFAULT 'AKTIF',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Warehouse_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadSource` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `status` ENUM('AKTIF', 'NONAKTIF') NOT NULL DEFAULT 'AKTIF',

    UNIQUE INDEX `LeadSource_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LostReason` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `status` ENUM('AKTIF', 'NONAKTIF') NOT NULL DEFAULT 'AKTIF',

    UNIQUE INDEX `LostReason_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExpenseCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `status` ENUM('AKTIF', 'NONAKTIF') NOT NULL DEFAULT 'AKTIF',

    UNIQUE INDEX `ExpenseCategory_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CostCenter` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `status` ENUM('AKTIF', 'NONAKTIF') NOT NULL DEFAULT 'AKTIF',

    UNIQUE INDEX `CostCenter_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lead` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `customerId` INTEGER NULL,
    `sourceId` INTEGER NULL,
    `clientType` ENUM('PARTNER', 'END_USER') NOT NULL DEFAULT 'END_USER',
    `need` VARCHAR(191) NULL,
    `contactName` VARCHAR(191) NULL,
    `estimatedValue` DECIMAL(18, 2) NULL,
    `probability` INTEGER NOT NULL DEFAULT 20,
    `targetClosing` DATE NULL,
    `owner_id` INTEGER NOT NULL,
    `stage` ENUM('PROSPECTING', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST') NOT NULL DEFAULT 'PROSPECTING',
    `lostReasonId` INTEGER NULL,
    `lostNote` VARCHAR(191) NULL,
    `needsSurvey` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Lead_stage_idx`(`stage`),
    INDEX `Lead_owner_id_idx`(`owner_id`),
    INDEX `Lead_customerId_idx`(`customerId`),
    INDEX `Lead_targetClosing_idx`(`targetClosing`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FollowUp` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `leadId` INTEGER NULL,
    `quotationId` INTEGER NULL,
    `date` DATE NOT NULL,
    `method` ENUM('EMAIL', 'TELEPON', 'WA', 'LAINNYA') NOT NULL,
    `notes` VARCHAR(191) NOT NULL,
    `nextDate` DATE NULL,
    `status` ENUM('TERJADWAL', 'SELESAI') NOT NULL DEFAULT 'SELESAI',
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FollowUp_leadId_idx`(`leadId`),
    INDEX `FollowUp_quotationId_idx`(`quotationId`),
    INDEX `FollowUp_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Survey` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `leadId` INTEGER NOT NULL,
    `location` VARCHAR(191) NOT NULL,
    `need` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `scheduleAt` DATETIME(3) NULL,
    `status` ENUM('DIMINTA', 'DIJADWALKAN', 'BERJALAN', 'SELESAI', 'BATAL') NOT NULL DEFAULT 'DIMINTA',
    `cost` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `requestedById` INTEGER NOT NULL,
    `approvedById` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectedReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Survey_status_idx`(`status`),
    INDEX `Survey_scheduleAt_idx`(`scheduleAt`),
    INDEX `Survey_leadId_idx`(`leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SurveyMember` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `surveyId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `SurveyMember_surveyId_userId_key`(`surveyId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Quotation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(191) NOT NULL,
    `leadId` INTEGER NOT NULL,
    `customerId` INTEGER NULL,
    `ownerId` INTEGER NOT NULL,
    `status` ENUM('NOT_YET', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SENT', 'NEGOTIATION', 'REVISION', 'EXPIRED') NOT NULL DEFAULT 'NOT_YET',
    `validUntil` DATE NULL,
    `currentVersion` INTEGER NOT NULL DEFAULT 0,
    `total` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `ppn` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `discount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `grandTotal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Quotation_number_key`(`number`),
    INDEX `Quotation_status_idx`(`status`),
    INDEX `Quotation_leadId_idx`(`leadId`),
    INDEX `Quotation_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuotationVersion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quotationId` INTEGER NOT NULL,
    `version` INTEGER NOT NULL,
    `fileId` INTEGER NULL,
    `total` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `ppn` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `discount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `grandTotal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `note` VARCHAR(191) NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `QuotationVersion_quotationId_version_key`(`quotationId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClientPO` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(191) NOT NULL,
    `customerId` INTEGER NOT NULL,
    `quotationId` INTEGER NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `date` DATE NOT NULL,
    `fileId` INTEGER NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ClientPO_number_key`(`number`),
    INDEX `ClientPO_customerId_idx`(`customerId`),
    INDEX `ClientPO_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceOut` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(191) NOT NULL,
    `clientPoId` INTEGER NULL,
    `projectId` INTEGER NULL,
    `customerId` INTEGER NOT NULL,
    `description` VARCHAR(191) NULL,
    `type` ENUM('DP', 'TERMIN', 'PELUNASAN') NOT NULL DEFAULT 'TERMIN',
    `amount` DECIMAL(18, 2) NOT NULL,
    `ppn` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(18, 2) NOT NULL,
    `paidAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `date` DATE NOT NULL,
    `dueDate` DATE NOT NULL,
    `status` ENUM('DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE', 'BATAL') NOT NULL DEFAULT 'DRAFT',
    `fileId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InvoiceOut_number_key`(`number`),
    INDEX `InvoiceOut_status_idx`(`status`),
    INDEX `InvoiceOut_dueDate_idx`(`dueDate`),
    INDEX `InvoiceOut_customerId_idx`(`customerId`),
    INDEX `InvoiceOut_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceIn` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(191) NULL,
    `supplierId` INTEGER NOT NULL,
    `supplierPoId` INTEGER NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `ppn` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(18, 2) NOT NULL,
    `paidAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `dueDate` DATE NOT NULL,
    `status` ENUM('UNPAID', 'PARTIAL', 'PAID', 'OVERDUE', 'BATAL') NOT NULL DEFAULT 'UNPAID',
    `fileId` INTEGER NULL,
    `transferFileId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `InvoiceIn_status_idx`(`status`),
    INDEX `InvoiceIn_dueDate_idx`(`dueDate`),
    INDEX `InvoiceIn_supplierId_idx`(`supplierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoiceOutId` INTEGER NULL,
    `invoiceInId` INTEGER NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `date` DATE NOT NULL,
    `method` ENUM('TRANSFER', 'TUNAI', 'QRIS', 'LAINNYA') NOT NULL DEFAULT 'TRANSFER',
    `reference` VARCHAR(191) NULL,
    `fileId` INTEGER NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Payment_invoiceOutId_idx`(`invoiceOutId`),
    INDEX `Payment_invoiceInId_idx`(`invoiceInId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Expense` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATE NOT NULL,
    `reporterId` INTEGER NOT NULL,
    `categoryId` INTEGER NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `status` ENUM('DILAPORKAN', 'DISETUJUI', 'DITOLAK', 'DIBAYAR') NOT NULL DEFAULT 'DILAPORKAN',
    `projectId` INTEGER NULL,
    `surveyId` INTEGER NULL,
    `deliveryNoteId` INTEGER NULL,
    `costCenterId` INTEGER NULL,
    `receiptFileId` INTEGER NULL,
    `paidFileId` INTEGER NULL,
    `paidAt` DATETIME(3) NULL,
    `rejectReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Expense_status_idx`(`status`),
    INDEX `Expense_reporterId_idx`(`reporterId`),
    INDEX `Expense_date_idx`(`date`),
    INDEX `Expense_projectId_idx`(`projectId`),
    INDEX `Expense_deliveryNoteId_idx`(`deliveryNoteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Project` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('CUSTOMER', 'PRODUCT_RD', 'INTERNAL', 'MAINTENANCE', 'SUPPORT', 'OTHER') NOT NULL DEFAULT 'CUSTOMER',
    `customerId` INTEGER NULL,
    `picId` INTEGER NOT NULL,
    `quotationId` INTEGER NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NULL,
    `status` ENUM('DIRENCANAKAN', 'BERJALAN', 'DITUNDA', 'TERLAMBAT', 'SELESAI') NOT NULL DEFAULT 'BERJALAN',
    `progress` INTEGER NOT NULL DEFAULT 0,
    `paymentStatus` ENUM('BELUM_LUNAS', 'LUNAS') NOT NULL DEFAULT 'BELUM_LUNAS',
    `prdFileId` INTEGER NULL,
    `notes` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Project_status_idx`(`status`),
    INDEX `Project_picId_idx`(`picId`),
    INDEX `Project_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectMember` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `ProjectMember_projectId_userId_key`(`projectId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Task` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `parentId` INTEGER NULL,
    `name` VARCHAR(191) NOT NULL,
    `assigneeId` INTEGER NULL,
    `dueDate` DATE NULL,
    `priority` ENUM('RENDAH', 'SEDANG', 'TINGGI', 'URGENT') NOT NULL DEFAULT 'SEDANG',
    `status` ENUM('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE') NOT NULL DEFAULT 'TODO',
    `progress` INTEGER NOT NULL DEFAULT 0,
    `needsPurchase` BOOLEAN NOT NULL DEFAULT false,
    `bahpFileId` INTEGER NULL,
    `bastFileId` INTEGER NULL,
    `doFileId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Task_projectId_idx`(`projectId`),
    INDEX `Task_assigneeId_idx`(`assigneeId`),
    INDEX `Task_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectRequirement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `taskId` INTEGER NULL,
    `productId` INTEGER NOT NULL,
    `qty` INTEGER NOT NULL,
    `reservedQty` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('DIBUTUHKAN', 'DIRESERVE', 'DIMINTA', 'DIPESAN', 'DITERIMA', 'DIBATALKAN') NOT NULL DEFAULT 'DIBUTUHKAN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProjectRequirement_projectId_idx`(`projectId`),
    INDEX `ProjectRequirement_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `requesterId` INTEGER NOT NULL,
    `costType` ENUM('PROJECT', 'STOK', 'INTERNAL', 'LAINNYA') NOT NULL,
    `projectId` INTEGER NULL,
    `taskId` INTEGER NULL,
    `supplierId` INTEGER NULL,
    `condition` ENUM('BARU', 'SECOND') NOT NULL DEFAULT 'BARU',
    `estimatedCost` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `purpose` VARCHAR(191) NOT NULL,
    `otherNote` VARCHAR(191) NULL,
    `evidenceFileId` INTEGER NULL,
    `status` ENUM('DIAJUKAN', 'CEK_STOK', 'DISETUJUI', 'DITOLAK', 'PO_DIBUAT', 'DIKIRIM', 'DITERIMA', 'DIBATALKAN') NOT NULL DEFAULT 'DIAJUKAN',
    `rejectReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PurchaseRequest_number_key`(`number`),
    INDEX `PurchaseRequest_status_idx`(`status`),
    INDEX `PurchaseRequest_projectId_idx`(`projectId`),
    INDEX `PurchaseRequest_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseRequestItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requestId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `qty` INTEGER NOT NULL,
    `unitCost` DECIMAL(18, 2) NOT NULL DEFAULT 0,

    INDEX `PurchaseRequestItem_requestId_idx`(`requestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupplierPO` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(191) NOT NULL,
    `supplierId` INTEGER NOT NULL,
    `requestId` INTEGER NULL,
    `date` DATE NOT NULL,
    `eta` DATE NULL,
    `paymentTerms` VARCHAR(191) NULL,
    `total` DECIMAL(18, 2) NOT NULL,
    `status` ENUM('MENUNGGU_PERSETUJUAN', 'DISETUJUI', 'DITOLAK', 'DIBATALKAN') NOT NULL DEFAULT 'MENUNGGU_PERSETUJUAN',
    `shipmentStatus` ENUM('DI_SUPPLIER', 'DIKIRIM', 'SAMPAI') NOT NULL DEFAULT 'DI_SUPPLIER',
    `fileId` INTEGER NULL,
    `doFileId` INTEGER NULL,
    `createdById` INTEGER NULL,
    `arrivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SupplierPO_number_key`(`number`),
    INDEX `SupplierPO_status_idx`(`status`),
    INDEX `SupplierPO_shipmentStatus_idx`(`shipmentStatus`),
    INDEX `SupplierPO_supplierId_idx`(`supplierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupplierPOItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `poId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `qty` INTEGER NOT NULL,
    `price` DECIMAL(18, 2) NOT NULL,
    `receivedQty` INTEGER NOT NULL DEFAULT 0,

    INDEX `SupplierPOItem_poId_idx`(`poId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Receiving` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(191) NOT NULL,
    `supplierPoId` INTEGER NOT NULL,
    `warehouseId` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `receiverId` INTEGER NOT NULL,
    `status` ENUM('MENUNGGU', 'DITERIMA_SEBAGIAN', 'DITERIMA', 'DITOLAK') NOT NULL DEFAULT 'MENUNGGU',
    `conditionNote` VARCHAR(191) NULL,
    `receiptFileId` INTEGER NULL,
    `photoFileId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Receiving_number_key`(`number`),
    INDEX `Receiving_status_idx`(`status`),
    INDEX `Receiving_supplierPoId_idx`(`supplierPoId`),
    INDEX `Receiving_warehouseId_idx`(`warehouseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReceivingItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `receivingId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `qtyOrdered` INTEGER NOT NULL,
    `qtyReceived` INTEGER NOT NULL DEFAULT 0,
    `note` VARCHAR(191) NULL,

    INDEX `ReceivingItem_receivingId_idx`(`receivingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IssueReport` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `receivingId` INTEGER NULL,
    `poNumber` VARCHAR(191) NULL,
    `productId` INTEGER NULL,
    `type` ENUM('RUSAK', 'SALAH_BARANG', 'KURANG') NOT NULL,
    `qty` INTEGER NOT NULL DEFAULT 1,
    `description` VARCHAR(191) NOT NULL,
    `fileId` INTEGER NULL,
    `reporterId` INTEGER NOT NULL,
    `status` ENUM('DILAPORKAN', 'DIPROSES', 'SELESAI') NOT NULL DEFAULT 'DILAPORKAN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `IssueReport_status_idx`(`status`),
    INDEX `IssueReport_receivingId_idx`(`receivingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockBalance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `warehouseId` INTEGER NOT NULL,
    `qty` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StockBalance_warehouseId_idx`(`warehouseId`),
    UNIQUE INDEX `StockBalance_productId_warehouseId_key`(`productId`, `warehouseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockMovement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATE NOT NULL,
    `type` ENUM('IN', 'OUT', 'TRANSFER') NOT NULL,
    `category` ENUM('PENERIMAAN_SUPPLIER', 'KELUAR_PROJECT', 'KELUAR_SURAT_JALAN', 'TRANSFER', 'RETUR_PROJECT', 'BARANG_TERPAKAI', 'PENGGANTIAN', 'PENYESUAIAN_OPNAME', 'LAINNYA') NOT NULL,
    `productId` INTEGER NOT NULL,
    `fromWarehouseId` INTEGER NULL,
    `toWarehouseId` INTEGER NULL,
    `qty` INTEGER NOT NULL,
    `serialUnitId` INTEGER NULL,
    `projectId` INTEGER NULL,
    `deliveryNoteId` INTEGER NULL,
    `receivingId` INTEGER NULL,
    `reason` VARCHAR(191) NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StockMovement_productId_idx`(`productId`),
    INDEX `StockMovement_date_idx`(`date`),
    INDEX `StockMovement_type_idx`(`type`),
    INDEX `StockMovement_fromWarehouseId_idx`(`fromWarehouseId`),
    INDEX `StockMovement_toWarehouseId_idx`(`toWarehouseId`),
    INDEX `StockMovement_deliveryNoteId_idx`(`deliveryNoteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SerialUnit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sn` VARCHAR(191) NOT NULL,
    `productId` INTEGER NOT NULL,
    `status` ENUM('DI_GUDANG', 'RESERVED', 'DIKIRIM', 'TERPASANG', 'RETUR', 'DIGANTI', 'RUSAK') NOT NULL DEFAULT 'DI_GUDANG',
    `warehouseId` INTEGER NULL,
    `projectId` INTEGER NULL,
    `warrantyEndsAt` DATE NULL,
    `replacedFromId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SerialUnit_sn_key`(`sn`),
    INDEX `SerialUnit_status_idx`(`status`),
    INDEX `SerialUnit_warehouseId_idx`(`warehouseId`),
    INDEX `SerialUnit_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SerialUnitHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `serialUnitId` INTEGER NOT NULL,
    `status` ENUM('DI_GUDANG', 'RESERVED', 'DIKIRIM', 'TERPASANG', 'RETUR', 'DIGANTI', 'RUSAK') NOT NULL,
    `warehouseId` INTEGER NULL,
    `projectId` INTEGER NULL,
    `note` VARCHAR(191) NULL,
    `changedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SerialUnitHistory_serialUnitId_idx`(`serialUnitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockReservation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `productId` INTEGER NULL,
    `serialUnitId` INTEGER NULL,
    `qty` INTEGER NOT NULL DEFAULT 1,
    `requirementId` INTEGER NULL,
    `releasedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StockReservation_projectId_idx`(`projectId`),
    INDEX `StockReservation_productId_idx`(`productId`),
    INDEX `StockReservation_releasedAt_idx`(`releasedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockOpname` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `warehouseId` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `conductorId` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'MENUNGGU_PERSETUJUAN', 'DISETUJUI', 'DITOLAK') NOT NULL DEFAULT 'DRAFT',
    `reason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StockOpname_status_idx`(`status`),
    INDEX `StockOpname_warehouseId_idx`(`warehouseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockOpnameDetail` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `opnameId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `systemQty` INTEGER NOT NULL,
    `countedQty` INTEGER NOT NULL,
    `diff` INTEGER NOT NULL,
    `note` VARCHAR(191) NULL,

    INDEX `StockOpnameDetail_opnameId_idx`(`opnameId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DamageReport` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATE NOT NULL,
    `productId` INTEGER NOT NULL,
    `serialUnitId` INTEGER NULL,
    `type` ENUM('RUSAK', 'SALAH_BARANG', 'KURANG') NOT NULL,
    `qty` INTEGER NOT NULL DEFAULT 1,
    `description` VARCHAR(191) NOT NULL,
    `fileId` INTEGER NULL,
    `reporterId` INTEGER NOT NULL,
    `status` ENUM('DILAPORKAN', 'DIPROSES', 'SELESAI') NOT NULL DEFAULT 'DILAPORKAN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DamageReport_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeliveryNote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(191) NOT NULL,
    `creatorId` INTEGER NOT NULL,
    `withGoods` BOOLEAN NOT NULL DEFAULT false,
    `date` DATE NOT NULL,
    `status` ENUM('PENDING', 'DIKIRIM', 'DITERIMA', 'DIBATALKAN') NOT NULL DEFAULT 'PENDING',
    `receiveById` INTEGER NULL,
    `receivedAt` DATETIME(3) NULL,
    `scanFileId` INTEGER NULL,
    `reportText` VARCHAR(191) NULL,
    `reportFileId` INTEGER NULL,
    `reportAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DeliveryNote_number_key`(`number`),
    INDEX `DeliveryNote_status_idx`(`status`),
    INDEX `DeliveryNote_creatorId_idx`(`creatorId`),
    INDEX `DeliveryNote_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeliveryNoteLocation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `deliveryNoteId` INTEGER NOT NULL,
    `destination` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `projectId` INTEGER NULL,

    INDEX `DeliveryNoteLocation_deliveryNoteId_idx`(`deliveryNoteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `File` ADD CONSTRAINT `File_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SystemSetting` ADD CONSTRAINT `SystemSetting_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Approval` ADD CONSTRAINT `Approval_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Approval` ADD CONSTRAINT `Approval_financeById_fkey` FOREIGN KEY (`financeById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Approval` ADD CONSTRAINT `Approval_bosById_fkey` FOREIGN KEY (`bosById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ProductCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `LeadSource`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_lostReasonId_fkey` FOREIGN KEY (`lostReasonId`) REFERENCES `LostReason`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FollowUp` ADD CONSTRAINT `FollowUp_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FollowUp` ADD CONSTRAINT `FollowUp_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FollowUp` ADD CONSTRAINT `FollowUp_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `Quotation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Survey` ADD CONSTRAINT `Survey_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Survey` ADD CONSTRAINT `Survey_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Survey` ADD CONSTRAINT `Survey_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyMember` ADD CONSTRAINT `SurveyMember_surveyId_fkey` FOREIGN KEY (`surveyId`) REFERENCES `Survey`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyMember` ADD CONSTRAINT `SurveyMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuotationVersion` ADD CONSTRAINT `QuotationVersion_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `Quotation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuotationVersion` ADD CONSTRAINT `QuotationVersion_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientPO` ADD CONSTRAINT `ClientPO_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientPO` ADD CONSTRAINT `ClientPO_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `Quotation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceOut` ADD CONSTRAINT `InvoiceOut_clientPoId_fkey` FOREIGN KEY (`clientPoId`) REFERENCES `ClientPO`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceOut` ADD CONSTRAINT `InvoiceOut_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceOut` ADD CONSTRAINT `InvoiceOut_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceIn` ADD CONSTRAINT `InvoiceIn_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceIn` ADD CONSTRAINT `InvoiceIn_supplierPoId_fkey` FOREIGN KEY (`supplierPoId`) REFERENCES `SupplierPO`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_invoiceOutId_fkey` FOREIGN KEY (`invoiceOutId`) REFERENCES `InvoiceOut`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_invoiceInId_fkey` FOREIGN KEY (`invoiceInId`) REFERENCES `InvoiceIn`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ExpenseCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_surveyId_fkey` FOREIGN KEY (`surveyId`) REFERENCES `Survey`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_deliveryNoteId_fkey` FOREIGN KEY (`deliveryNoteId`) REFERENCES `DeliveryNote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_costCenterId_fkey` FOREIGN KEY (`costCenterId`) REFERENCES `CostCenter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_picId_fkey` FOREIGN KEY (`picId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `Quotation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMember` ADD CONSTRAINT `ProjectMember_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMember` ADD CONSTRAINT `ProjectMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectRequirement` ADD CONSTRAINT `ProjectRequirement_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectRequirement` ADD CONSTRAINT `ProjectRequirement_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectRequirement` ADD CONSTRAINT `ProjectRequirement_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseRequest` ADD CONSTRAINT `PurchaseRequest_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseRequest` ADD CONSTRAINT `PurchaseRequest_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseRequest` ADD CONSTRAINT `PurchaseRequest_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseRequest` ADD CONSTRAINT `PurchaseRequest_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseRequestItem` ADD CONSTRAINT `PurchaseRequestItem_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `PurchaseRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseRequestItem` ADD CONSTRAINT `PurchaseRequestItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierPO` ADD CONSTRAINT `SupplierPO_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierPO` ADD CONSTRAINT `SupplierPO_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `PurchaseRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierPO` ADD CONSTRAINT `SupplierPO_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierPOItem` ADD CONSTRAINT `SupplierPOItem_poId_fkey` FOREIGN KEY (`poId`) REFERENCES `SupplierPO`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierPOItem` ADD CONSTRAINT `SupplierPOItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Receiving` ADD CONSTRAINT `Receiving_supplierPoId_fkey` FOREIGN KEY (`supplierPoId`) REFERENCES `SupplierPO`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Receiving` ADD CONSTRAINT `Receiving_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Receiving` ADD CONSTRAINT `Receiving_receiverId_fkey` FOREIGN KEY (`receiverId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReceivingItem` ADD CONSTRAINT `ReceivingItem_receivingId_fkey` FOREIGN KEY (`receivingId`) REFERENCES `Receiving`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReceivingItem` ADD CONSTRAINT `ReceivingItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueReport` ADD CONSTRAINT `IssueReport_receivingId_fkey` FOREIGN KEY (`receivingId`) REFERENCES `Receiving`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueReport` ADD CONSTRAINT `IssueReport_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueReport` ADD CONSTRAINT `IssueReport_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockBalance` ADD CONSTRAINT `StockBalance_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockBalance` ADD CONSTRAINT `StockBalance_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_fromWarehouseId_fkey` FOREIGN KEY (`fromWarehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_toWarehouseId_fkey` FOREIGN KEY (`toWarehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_serialUnitId_fkey` FOREIGN KEY (`serialUnitId`) REFERENCES `SerialUnit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_deliveryNoteId_fkey` FOREIGN KEY (`deliveryNoteId`) REFERENCES `DeliveryNote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SerialUnit` ADD CONSTRAINT `SerialUnit_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SerialUnit` ADD CONSTRAINT `SerialUnit_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SerialUnit` ADD CONSTRAINT `SerialUnit_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SerialUnit` ADD CONSTRAINT `SerialUnit_replacedFromId_fkey` FOREIGN KEY (`replacedFromId`) REFERENCES `SerialUnit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SerialUnitHistory` ADD CONSTRAINT `SerialUnitHistory_serialUnitId_fkey` FOREIGN KEY (`serialUnitId`) REFERENCES `SerialUnit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SerialUnitHistory` ADD CONSTRAINT `SerialUnitHistory_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockReservation` ADD CONSTRAINT `StockReservation_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockReservation` ADD CONSTRAINT `StockReservation_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockReservation` ADD CONSTRAINT `StockReservation_serialUnitId_fkey` FOREIGN KEY (`serialUnitId`) REFERENCES `SerialUnit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockOpname` ADD CONSTRAINT `StockOpname_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockOpname` ADD CONSTRAINT `StockOpname_conductorId_fkey` FOREIGN KEY (`conductorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockOpnameDetail` ADD CONSTRAINT `StockOpnameDetail_opnameId_fkey` FOREIGN KEY (`opnameId`) REFERENCES `StockOpname`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockOpnameDetail` ADD CONSTRAINT `StockOpnameDetail_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DamageReport` ADD CONSTRAINT `DamageReport_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DamageReport` ADD CONSTRAINT `DamageReport_serialUnitId_fkey` FOREIGN KEY (`serialUnitId`) REFERENCES `SerialUnit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DamageReport` ADD CONSTRAINT `DamageReport_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryNote` ADD CONSTRAINT `DeliveryNote_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryNoteLocation` ADD CONSTRAINT `DeliveryNoteLocation_deliveryNoteId_fkey` FOREIGN KEY (`deliveryNoteId`) REFERENCES `DeliveryNote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryNoteLocation` ADD CONSTRAINT `DeliveryNoteLocation_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
