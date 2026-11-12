import { Injectable, OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import * as bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/prisma/client.js";

function makeClient(urlEnv: string): PrismaClient {
  const raw = process.env[urlEnv];
  if (!raw) throw new Error(`${urlEnv} tidak di-set`);
  const u = new URL(raw);
  if (!u.searchParams.has("allowPublicKeyRetrieval")) {
    u.searchParams.set("allowPublicKeyRetrieval", "true");
  }
  return new PrismaClient({ adapter: new PrismaMariaDb(u.toString()) });
}

const ROLE_ENUM_SQL = "ENUM('SUPER_ADMIN','ADMIN','BOS','SALES','PM','TEKNISI','PROCUREMENT','FINANCE','GUDANG','SE','HR')";

/**
 * Dua instance Prisma dengan klien yang sama:
 *  - `main`   → database operasional (DATABASE_URL)
 *  - `archive`→ database arsip (ARCHIVE_DATABASE_URL), berumur > 2 tahun
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnApplicationShutdown {
  readonly main: PrismaClient;
  readonly archive: PrismaClient;

  constructor() {
    this.main = makeClient("DATABASE_URL");
    this.archive = makeClient("ARCHIVE_DATABASE_URL");
  }

  private async ensureRoleEnums(db: PrismaClient) {
    try {
      await db.$executeRawUnsafe("ALTER TABLE `User` MODIFY COLUMN `role` VARCHAR(64) NOT NULL DEFAULT 'SALES'");
      await db.$executeRawUnsafe("ALTER TABLE `Notification` MODIFY COLUMN `targetRole` VARCHAR(64) NULL");
      await db.$executeRawUnsafe("ALTER TABLE `ApprovalStep` MODIFY COLUMN `approverRole` VARCHAR(64) NOT NULL");
      await db.$executeRawUnsafe("ALTER TABLE `SystemSetting` MODIFY COLUMN `value` LONGTEXT NOT NULL");
    } catch {}
    // Ensure StockReservation & item serial columns for Phase 1-5 SN reservation flow
    const schemaPatches = [
      "ALTER TABLE `StockReservation` MODIFY COLUMN `projectId` INT NULL",
      "ALTER TABLE `StockReservation` ADD COLUMN `quotationId` INT NULL",
      "ALTER TABLE `StockReservation` ADD COLUMN `invoiceId` INT NULL",
      "ALTER TABLE `StockReservation` ADD COLUMN `purchaseRequestId` INT NULL",
      "CREATE INDEX `StockReservation_quotationId_idx` ON `StockReservation`(`quotationId`)",
      "CREATE INDEX `StockReservation_invoiceId_idx` ON `StockReservation`(`invoiceId`)",
      "CREATE INDEX `StockReservation_purchaseRequestId_idx` ON `StockReservation`(`purchaseRequestId`)",
      "CREATE INDEX `StockReservation_serialUnitId_idx` ON `StockReservation`(`serialUnitId`)",
      "ALTER TABLE `ProjectRequirement` ADD COLUMN `serials` TEXT NULL",
      "ALTER TABLE `PurchaseRequestItem` ADD COLUMN `serials` TEXT NULL",
      "ALTER TABLE `PurchaseRequest` ADD COLUMN `doFileId` INT NULL",
      "ALTER TABLE `DeliveryNote` MODIFY COLUMN `reportText` LONGTEXT NULL",
      "ALTER TABLE `Project` ADD COLUMN `boqFileId` INT NULL",
      "CREATE TABLE IF NOT EXISTS `Attendance` (`id` INT NOT NULL AUTO_INCREMENT, `userId` INT NOT NULL, `date` DATE NOT NULL, `checkIn` DATETIME(3) NULL, `checkOut` DATETIME(3) NULL, `status` VARCHAR(191) NOT NULL DEFAULT 'HADIR', `overtimeHours` DECIMAL(6,2) NOT NULL DEFAULT 0, `notes` VARCHAR(191) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), UNIQUE INDEX `Attendance_userId_date_key` (`userId`, `date`), INDEX `Attendance_date_idx` (`date`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      "CREATE TABLE IF NOT EXISTS `SalaryConfig` (`userId` INT NOT NULL, `basicSalary` DECIMAL(18,2) NOT NULL DEFAULT 0, `allowance` DECIMAL(18,2) NOT NULL DEFAULT 0, `ptkp` VARCHAR(191) NOT NULL DEFAULT 'TK/0', `hasNpwp` BOOLEAN NOT NULL DEFAULT true, `pph21Rate` DECIMAL(6,3) NULL, `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`userId`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      "CREATE TABLE IF NOT EXISTS `PayrollSlip` (`id` INT NOT NULL AUTO_INCREMENT, `period` VARCHAR(191) NOT NULL, `userId` INT NOT NULL, `basicSalary` DECIMAL(18,2) NOT NULL DEFAULT 0, `allowance` DECIMAL(18,2) NOT NULL DEFAULT 0, `overtimePay` DECIMAL(18,2) NOT NULL DEFAULT 0, `absentDeduct` DECIMAL(18,2) NOT NULL DEFAULT 0, `grossSalary` DECIMAL(18,2) NOT NULL DEFAULT 0, `bpjs` DECIMAL(18,2) NOT NULL DEFAULT 0, `pph21` DECIMAL(18,2) NOT NULL DEFAULT 0, `netSalary` DECIMAL(18,2) NOT NULL DEFAULT 0, `workDays` INT NOT NULL DEFAULT 0, `presentDays` INT NOT NULL DEFAULT 0, `absentDays` INT NOT NULL DEFAULT 0, `lateCount` INT NOT NULL DEFAULT 0, `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT', `paidAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), UNIQUE INDEX `PayrollSlip_period_userId_key` (`period`, `userId`), INDEX `PayrollSlip_period_idx` (`period`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      "ALTER TABLE `Supplier` ADD COLUMN `taxStatus` VARCHAR(32) NOT NULL DEFAULT 'NON_PKP'",
      "CREATE TABLE IF NOT EXISTS `SupplierItemTag` (`id` INT NOT NULL AUTO_INCREMENT, `supplierId` INT NOT NULL, `itemName` VARCHAR(191) NOT NULL, `price` DECIMAL(18,2) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), INDEX `SupplierItemTag_supplierId_idx` (`supplierId`), INDEX `SupplierItemTag_itemName_idx` (`itemName`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      "CREATE TABLE IF NOT EXISTS `VisitActivityType` (`id` INT NOT NULL AUTO_INCREMENT, `name` VARCHAR(191) NOT NULL, `status` VARCHAR(32) NOT NULL DEFAULT 'AKTIF', PRIMARY KEY (`id`), UNIQUE INDEX `VisitActivityType_name_key` (`name`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      "CREATE TABLE IF NOT EXISTS `VisitReport` (`id` INT NOT NULL AUTO_INCREMENT, `number` VARCHAR(191) NOT NULL, `title` VARCHAR(191) NOT NULL, `activityTypeId` INT NULL, `activityTypeName` VARCHAR(191) NULL, `status` VARCHAR(191) NOT NULL DEFAULT 'Planned', `date` DATE NOT NULL, `endDate` DATE NULL, `location` VARCHAR(191) NULL, `clientName` VARCHAR(191) NULL, `clientContact` VARCHAR(191) NULL, `customerId` INT NULL, `leadId` INT NULL, `projectId` INT NULL, `purpose` TEXT NULL, `description` TEXT NULL, `summary` TEXT NULL, `clientNeeds` TEXT NULL, `productsIntroduced` TEXT NULL, `clientFeedback` TEXT NULL, `agreements` TEXT NULL, `potentialOpportunities` TEXT NULL, `obstacles` TEXT NULL, `conclusion` TEXT NULL, `companyHeader` VARCHAR(191) NULL, `logoFileId` INT NULL, `documentFileId` INT NULL, `ownerId` INT NOT NULL, `createdById` INT NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), UNIQUE INDEX `VisitReport_number_key` (`number`), INDEX `VisitReport_status_idx` (`status`), INDEX `VisitReport_date_idx` (`date`), INDEX `VisitReport_ownerId_idx` (`ownerId`), INDEX `VisitReport_projectId_idx` (`projectId`), INDEX `VisitReport_customerId_idx` (`customerId`), INDEX `VisitReport_leadId_idx` (`leadId`), INDEX `VisitReport_activityTypeId_idx` (`activityTypeId`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      "CREATE TABLE IF NOT EXISTS `VisitMember` (`id` INT NOT NULL AUTO_INCREMENT, `visitReportId` INT NOT NULL, `userId` INT NOT NULL, PRIMARY KEY (`id`), UNIQUE INDEX `VisitMember_visitReportId_userId_key` (`visitReportId`, `userId`), INDEX `VisitMember_visitReportId_idx` (`visitReportId`), INDEX `VisitMember_userId_idx` (`userId`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      "CREATE TABLE IF NOT EXISTS `VisitActionItem` (`id` INT NOT NULL AUTO_INCREMENT, `visitReportId` INT NOT NULL, `task` TEXT NOT NULL, `assigneeId` INT NULL, `dueDate` DATE NULL, `status` VARCHAR(191) NOT NULL DEFAULT 'Open', `notes` TEXT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), INDEX `VisitActionItem_visitReportId_idx` (`visitReportId`), INDEX `VisitActionItem_assigneeId_idx` (`assigneeId`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      "CREATE TABLE IF NOT EXISTS `PocReport` (`id` INT NOT NULL AUTO_INCREMENT, `number` VARCHAR(191) NOT NULL, `title` VARCHAR(191) NOT NULL, `description` TEXT NULL, `date` DATE NOT NULL, `endDate` DATE NULL, `location` VARCHAR(191) NULL, `type` VARCHAR(191) NOT NULL DEFAULT 'DEMO_CLIENT', `status` VARCHAR(191) NOT NULL DEFAULT 'Draft', `resultStatus` VARCHAR(191) NULL, `clientName` VARCHAR(191) NULL, `customerId` INT NULL, `projectId` INT NULL, `leadId` INT NULL, `targetCriteria` TEXT NULL, `productsTested` TEXT NULL, `budget` DECIMAL(18,2) NOT NULL DEFAULT 0, `actualCost` DECIMAL(18,2) NOT NULL DEFAULT 0, `actualExecutionDate` DATE NULL, `actualAttendees` TEXT NULL, `activitiesDone` TEXT NULL, `testResults` TEXT NULL, `issuesFound` TEXT NULL, `followUpNeeded` TEXT NULL, `conclusion` TEXT NULL, `recommendations` TEXT NULL, `companyHeader` VARCHAR(191) NULL, `logoFileId` INT NULL, `documentFileId` INT NULL, `ownerId` INT NOT NULL, `createdById` INT NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), UNIQUE INDEX `PocReport_number_key` (`number`), INDEX `PocReport_status_idx` (`status`), INDEX `PocReport_date_idx` (`date`), INDEX `PocReport_ownerId_idx` (`ownerId`), INDEX `PocReport_projectId_idx` (`projectId`), INDEX `PocReport_customerId_idx` (`customerId`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      "CREATE TABLE IF NOT EXISTS `PocMember` (`id` INT NOT NULL AUTO_INCREMENT, `pocReportId` INT NOT NULL, `userId` INT NOT NULL, PRIMARY KEY (`id`), UNIQUE INDEX `PocMember_pocReportId_userId_key` (`pocReportId`, `userId`), INDEX `PocMember_pocReportId_idx` (`pocReportId`), INDEX `PocMember_userId_idx` (`userId`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      "CREATE TABLE IF NOT EXISTS `PocChecklist` (`id` INT NOT NULL AUTO_INCREMENT, `pocReportId` INT NOT NULL, `title` VARCHAR(191) NOT NULL, `isDone` BOOLEAN NOT NULL DEFAULT false, `dueDate` DATE NULL, `assigneeId` INT NULL, `notes` VARCHAR(191) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), INDEX `PocChecklist_pocReportId_idx` (`pocReportId`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      "ALTER TABLE `Expense` ADD COLUMN `pocReportId` INT NULL",
      "ALTER TABLE `Expense` ADD COLUMN `visitReportId` INT NULL",
      "ALTER TABLE `Expense` ADD COLUMN `fundingSource` VARCHAR(191) NOT NULL DEFAULT 'PERUSAHAAN'",
      "ALTER TABLE `Expense` ADD COLUMN `reimbursementStatus` VARCHAR(191) NULL",
      "ALTER TABLE `Expense` ADD COLUMN `paymentMethod` VARCHAR(191) NULL",
      "ALTER TABLE `Expense` ADD COLUMN `approvedAmount` DECIMAL(18,2) NULL",
      "ALTER TABLE `Expense` ADD COLUMN `paidAmount` DECIMAL(18,2) NULL",
      "ALTER TABLE `Expense` ADD COLUMN `paidById` INT NULL",
      "ALTER TABLE `Expense` ADD COLUMN `receiptFileIds` TEXT NULL",
      "CREATE TABLE IF NOT EXISTS `CalendarEvent` (`id` INT NOT NULL AUTO_INCREMENT, `number` VARCHAR(191) NOT NULL, `title` VARCHAR(191) NOT NULL, `description` TEXT NULL, `category` VARCHAR(191) NOT NULL DEFAULT 'MEETING', `status` VARCHAR(191) NOT NULL DEFAULT 'NOT_STARTED', `priority` VARCHAR(191) NOT NULL DEFAULT 'MEDIUM', `startDate` DATETIME(3) NOT NULL, `endDate` DATETIME(3) NULL, `isAllDay` BOOLEAN NOT NULL DEFAULT false, `recurrence` VARCHAR(191) NOT NULL DEFAULT 'NONE', `recurrenceUntil` DATETIME(3) NULL, `reminderMinutes` INT NULL, `lastRemindedAt` DATETIME(3) NULL, `completionNote` TEXT NULL, `creatorId` INT NOT NULL, `assigneeId` INT NULL, `customerId` INT NULL, `projectId` INT NULL, `leadId` INT NULL, `invoiceId` INT NULL, `supplierId` INT NULL, `excludedDates` TEXT NULL, `overdueNotifiedAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), UNIQUE INDEX `CalendarEvent_number_key` (`number`), INDEX `CalendarEvent_startDate_idx` (`startDate`), INDEX `CalendarEvent_assigneeId_idx` (`assigneeId`), INDEX `CalendarEvent_creatorId_idx` (`creatorId`), INDEX `CalendarEvent_category_idx` (`category`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      "ALTER TABLE `CalendarEvent` ADD COLUMN `invoiceId` INT NULL",
      "ALTER TABLE `CalendarEvent` ADD COLUMN `supplierId` INT NULL",
      "ALTER TABLE `CalendarEvent` ADD COLUMN `excludedDates` TEXT NULL",
      "ALTER TABLE `CalendarEvent` ADD COLUMN `overdueNotifiedAt` DATETIME(3) NULL",
      "CREATE TABLE IF NOT EXISTS `CalendarAttendee` (`id` INT NOT NULL AUTO_INCREMENT, `eventId` INT NOT NULL, `userId` INT NOT NULL, PRIMARY KEY (`id`), UNIQUE INDEX `CalendarAttendee_eventId_userId_key` (`eventId`, `userId`), INDEX `CalendarAttendee_userId_idx` (`userId`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      "ALTER TABLE `FollowUp` ADD COLUMN `pocReportId` INT NULL",
      "ALTER TABLE `FollowUp` ADD COLUMN `visitReportId` INT NULL",
      "CREATE TABLE IF NOT EXISTS `CoaAccount` (`id` INT NOT NULL AUTO_INCREMENT, `code` VARCHAR(64) NOT NULL, `name` VARCHAR(191) NOT NULL, `category` VARCHAR(191) NOT NULL, `normalBalance` VARCHAR(32) NOT NULL DEFAULT 'DEBIT', `type` VARCHAR(64) NULL, `parentCode` VARCHAR(64) NULL, `status` VARCHAR(32) NOT NULL DEFAULT 'AKTIF', `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), UNIQUE INDEX `CoaAccount_code_key` (`code`), INDEX `CoaAccount_parentCode_idx` (`parentCode`), INDEX `CoaAccount_category_idx` (`category`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      "ALTER TABLE `PurchaseRequest` ADD COLUMN `procurementSource` VARCHAR(64) NULL DEFAULT 'SUPPLIER'",
      "ALTER TABLE `PurchaseRequest` ADD COLUMN `paymentMethod` VARCHAR(64) NULL DEFAULT 'UTANG'",
      "ALTER TABLE `PurchaseRequestItem` MODIFY COLUMN `productId` INT NULL",
      "ALTER TABLE `PurchaseRequestItem` ADD COLUMN `customName` VARCHAR(191) NULL",
      "ALTER TABLE `PurchaseRequestItem` ADD COLUMN `customUnit` VARCHAR(64) NULL",
      "ALTER TABLE `SupplierPOItem` MODIFY COLUMN `productId` INT NULL",
      "ALTER TABLE `SupplierPOItem` ADD COLUMN `customName` VARCHAR(191) NULL",
      "ALTER TABLE `SupplierPOItem` ADD COLUMN `customUnit` VARCHAR(64) NULL",
      "ALTER TABLE `PurchaseRequest` MODIFY COLUMN `status` ENUM('DIAJUKAN','CEK_STOK','DISETUJUI','DIBAYAR','DITOLAK','PO_DIBUAT','DIKIRIM','DITERIMA','DIBATALKAN') NOT NULL DEFAULT 'DIAJUKAN'",
      "ALTER TABLE `PurchaseRequest` ADD COLUMN `paymentStatus` VARCHAR(64) NULL DEFAULT 'BELUM_DIBAYAR'",
      "ALTER TABLE `PurchaseRequest` ADD COLUMN `paymentProofFileId` INT NULL",
      "ALTER TABLE `Receiving` ADD COLUMN `requestId` INT NULL",
      "ALTER TABLE `CoaAccount` ADD COLUMN `isPostable` BOOLEAN NOT NULL DEFAULT true",
      "ALTER TABLE `CoaAccount` ADD COLUMN `isCash` BOOLEAN NOT NULL DEFAULT false",
      "ALTER TABLE `CoaAccount` ADD COLUMN `isSystem` BOOLEAN NOT NULL DEFAULT false",
      "ALTER TABLE `ExpenseCategory` ADD COLUMN `coaAccount` VARCHAR(64) NULL",
      "ALTER TABLE `Expense` ADD COLUMN `paidAccountCode` VARCHAR(64) NULL",
      "ALTER TABLE `PayrollSlip` ADD COLUMN `paidAccountCode` VARCHAR(64) NULL",
      "ALTER TABLE `Payment` ADD COLUMN `accountCode` VARCHAR(64) NULL",
      "ALTER TABLE `Product` ADD COLUMN `avgCost` DECIMAL(18,4) NOT NULL DEFAULT 0",
      "ALTER TABLE `StockMovement` ADD COLUMN `unitCost` DECIMAL(18,4) NULL",
      "ALTER TABLE `StockMovement` ADD COLUMN `totalCost` DECIMAL(18,2) NULL",
      "ALTER TABLE `InvoiceOut` ADD COLUMN `dpApplied` DECIMAL(18,2) NOT NULL DEFAULT 0",
      "ALTER TABLE `InvoiceOut` ADD COLUMN `retentionPercent` DECIMAL(5,2) NULL",
      "ALTER TABLE `InvoiceOut` ADD COLUMN `retentionAmount` DECIMAL(18,2) NULL",
      "CREATE TABLE IF NOT EXISTS `AccountingPeriod` (`id` INT NOT NULL AUTO_INCREMENT, `year` INT NOT NULL, `month` INT NOT NULL, `status` ENUM('OPEN','REQUESTED_CLOSE','CLOSED') NOT NULL DEFAULT 'OPEN', `requestedAt` DATETIME(3) NULL, `requestedById` INT NULL, `closedAt` DATETIME(3) NULL, `closedById` INT NULL, `reopenedAt` DATETIME(3) NULL, `reopenedById` INT NULL, `note` VARCHAR(191) NULL, `reopenReason` VARCHAR(191) NULL, PRIMARY KEY (`id`), UNIQUE INDEX `AccountingPeriod_year_month_key` (`year`, `month`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      "CREATE TABLE IF NOT EXISTS `FiscalYear` (`year` INT NOT NULL, `status` ENUM('OPEN','REQUESTED_CLOSE','CLOSED') NOT NULL DEFAULT 'OPEN', `closingEntryId` INT NULL, `closedAt` DATETIME(3) NULL, `closedById` INT NULL, `reopenedAt` DATETIME(3) NULL, `reopenedById` INT NULL, `reopenReason` VARCHAR(191) NULL, PRIMARY KEY (`year`), UNIQUE INDEX `FiscalYear_closingEntryId_key` (`closingEntryId`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      "CREATE TABLE IF NOT EXISTS `AccountMapping` (`key` VARCHAR(191) NOT NULL, `accountCode` VARCHAR(64) NOT NULL, `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`key`), INDEX `AccountMapping_accountCode_idx` (`accountCode`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      "CREATE TABLE IF NOT EXISTS `JournalEntry` (`id` INT NOT NULL AUTO_INCREMENT, `number` VARCHAR(191) NOT NULL, `date` DATE NOT NULL, `source` VARCHAR(64) NOT NULL, `sourceType` VARCHAR(64) NULL, `sourceId` INT NULL, `event` VARCHAR(64) NULL, `version` INT NOT NULL DEFAULT 1, `memo` TEXT NOT NULL, `refNo` VARCHAR(191) NULL, `projectId` INT NULL, `status` ENUM('POSTED','REVERSED') NOT NULL DEFAULT 'POSTED', `reversalOfId` INT NULL, `periodId` INT NOT NULL, `createdById` INT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), UNIQUE INDEX `JournalEntry_number_key` (`number`), UNIQUE INDEX `JournalEntry_reversalOfId_key` (`reversalOfId`), UNIQUE INDEX `JournalEntry_sourceType_sourceId_event_version_key` (`sourceType`, `sourceId`, `event`, `version`), INDEX `JournalEntry_date_idx` (`date`), INDEX `JournalEntry_source_idx` (`source`), INDEX `JournalEntry_projectId_idx` (`projectId`), INDEX `JournalEntry_periodId_idx` (`periodId`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      "CREATE TABLE IF NOT EXISTS `JournalLine` (`id` INT NOT NULL AUTO_INCREMENT, `entryId` INT NOT NULL, `lineNo` INT NOT NULL, `accountCode` VARCHAR(64) NOT NULL, `debit` DECIMAL(18,2) NOT NULL DEFAULT 0, `credit` DECIMAL(18,2) NOT NULL DEFAULT 0, `memo` VARCHAR(191) NULL, `projectId` INT NULL, `partyType` VARCHAR(64) NULL, `partyId` INT NULL, PRIMARY KEY (`id`), INDEX `JournalLine_entryId_idx` (`entryId`), INDEX `JournalLine_accountCode_idx` (`accountCode`), INDEX `JournalLine_projectId_idx` (`projectId`), INDEX `JournalLine_partyType_partyId_idx` (`partyType`, `partyId`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
    ];
    for (const sql of schemaPatches) {
      await db.$executeRawUnsafe(sql).catch(() => {});
    }
  }

  async onModuleInit() {
    await Promise.all([this.main.$connect(), this.archive.$connect()]);
    await Promise.allSettled([this.ensureRoleEnums(this.main), this.ensureRoleEnums(this.archive)]);
    try {
      const existing = await this.main.user.findUnique({ where: { email: "superadmin@taska.co.id" } });
      if (!existing) {
        const passwordHash = await bcrypt.hash("taska123", 10);
        await this.main.user.create({
          data: {
            email: "superadmin@taska.co.id",
            name: "Super Admin",
            role: "SUPER_ADMIN",
            position: "Super Administrator",
            department: "IT / Direksi",
            phone: "0811-0000-0000",
            passwordHash,
          },
        });
      }

      // Bersihkan duplikat data seed akibat upsert id=1 sebelumnya
      const dupLeads = await this.main.lead.findMany({
        where: { name: "Pengadaan Access Control & CCTV Gedung" },
        orderBy: { id: "asc" },
      });
      if (dupLeads.length > 1) {
        const extraIds = dupLeads.slice(1).map((l) => l.id);
        await this.main.lead.deleteMany({ where: { id: { in: extraIds } } }).catch(() => {});
      }

      const dupProjects = await this.main.project.findMany({
        where: { name: "Instalasi Jaringan & CCTV Kantor Pusat" },
        orderBy: { id: "asc" },
      });
      if (dupProjects.length > 1) {
        const extraProjIds = dupProjects.slice(1).map((p) => p.id);
        await this.main.task.deleteMany({ where: { projectId: { in: extraProjIds } } }).catch(() => {});
        await this.main.project.deleteMany({ where: { id: { in: extraProjIds } } }).catch(() => {});
      }

      const dupCustomers = await this.main.customer.findMany({
        where: { name: "PT Integrasi Sistem Solusindo" },
        orderBy: { id: "asc" },
      });
      if (dupCustomers.length > 1) {
        const extraCustIds = dupCustomers.slice(1).map((c) => c.id);
        await this.main.customer.deleteMany({ where: { id: { in: extraCustIds } } }).catch(() => {});
      }

      // Pastikan persetujuan OPNAME yang masih menunggu diarahkan ke PROCUREMENT
      const pendingOpnames = await this.main.approval.findMany({
        where: { kind: "OPNAME", status: "MENUNGGU" },
        select: { id: true },
      });
      if (pendingOpnames.length > 0) {
        const opnameIds = pendingOpnames.map((o) => o.id);
        await this.main.approvalStep.deleteMany({
          where: { approvalId: { in: opnameIds }, approverRole: "BOS" },
        }).catch(() => {});
        await this.main.approvalStep.updateMany({
          where: { approvalId: { in: opnameIds }, approverRole: "FINANCE" },
          data: { approverRole: "PROCUREMENT" },
        }).catch(() => {});
      }

      // Pastikan akun COA standar & akun sistem tersedia
      const defaultCoas = [
        { code: "1000", name: "Kas & Bank (Header)", category: "Aset Lancar", normalBalance: "DEBIT", isPostable: false, isCash: false, isSystem: true, parentCode: null },
        { code: "1000.01", name: "Kas Kecil", category: "Aset Lancar", normalBalance: "DEBIT", isPostable: true, isCash: true, isSystem: true, parentCode: "1000" },
        { code: "1000.02", name: "Bank Mandiri PT GMP", category: "Aset Lancar", normalBalance: "DEBIT", isPostable: true, isCash: true, isSystem: true, parentCode: "1000" },
        { code: "1100", name: "Piutang (Header)", category: "Aset Lancar", normalBalance: "DEBIT", isPostable: false, isCash: false, isSystem: true, parentCode: null },
        { code: "1100.02", name: "Uang Muka Pembelian", category: "Aset Lancar", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: "1100" },
        { code: "110302", name: "Account Receivable (Piutang Usaha)", category: "Aset Lancar", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: "1100" },
        { code: "110303", name: "Piutang Retensi Proyek", category: "Aset Lancar", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: "1100" },
        { code: "1105.01", name: "Uang Muka PPh 23 (Dipotong Customer)", category: "Aset Lancar", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: "1100" },
        { code: "1105.02", name: "Uang Muka PPh 25 (Angsuran Bulanan)", category: "Aset Lancar", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: "1100" },
        { code: "1106", name: "Piutang Kelebihan Bayar Pajak", category: "Aset Lancar", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: "1100" },
        { code: "1200", name: "Persediaan barang dagang", category: "Aset Lancar", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: null },
        { code: "1300", name: "Perlengkapan", category: "Aset Lancar", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: false, parentCode: null },
        { code: "1600", name: "Ppn masukan", category: "Aset Lancar", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: null },
        { code: "2000", name: "Hutang (Header)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", isPostable: false, isCash: false, isSystem: true, parentCode: null },
        { code: "2100", name: "Ppn Keluaran", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: true, parentCode: "2000" },
        { code: "210102", name: "Account Payable (Hutang Usaha)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: true, parentCode: "2000" },
        { code: "210202", name: "Advance Sales (Uang Muka Penjualan)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: true, parentCode: "2000" },
        { code: "2103", name: "Hutang Biaya & Reimbursement Operasional", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: true, parentCode: "2000" },
        { code: "2104", name: "Hutang PPh Potong / Pungut", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: true, parentCode: "2000" },
        { code: "2105", name: "Hutang PPh Pasal 21 (Karyawan)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: true, parentCode: "2000" },
        { code: "2106", name: "Hutang PPh Pasal 23 (Jasa / Vendor)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: true, parentCode: "2000" },
        { code: "2107", name: "Hutang BPJS Karyawan", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: true, parentCode: "2000" },
        { code: "2108", name: "Goods Received Not Invoiced (GRNI)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: true, parentCode: "2000" },
        { code: "2109", name: "Hutang Pajak Penghasilan (PPh 29)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: true, parentCode: "2000" },
        { code: "3000", name: "Modal (Header)", category: "Ekuitas", normalBalance: "KREDIT", isPostable: false, isCash: false, isSystem: true, parentCode: null },
        { code: "310001", name: "OPENING BALANCE EQUITY", category: "Ekuitas", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: true, parentCode: "3000" },
        { code: "3101", name: "Modal Disetor", category: "Ekuitas", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: true, parentCode: "3000" },
        { code: "3102", name: "Laba Ditahan", category: "Ekuitas", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: true, parentCode: "3000" },
        { code: "3200.02", name: "Dividend", category: "Ekuitas", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: true, parentCode: "3000" },
        { code: "4000", name: "Pendapatan (Header)", category: "Pendapatan", normalBalance: "KREDIT", isPostable: false, isCash: false, isSystem: true, parentCode: null },
        { code: "4000.01", name: "Penjualan Barang Dagang", category: "Pendapatan", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: true, parentCode: "4000" },
        { code: "4000.02", name: "Pendapatan Jasa & Instalasi", category: "Pendapatan", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: true, parentCode: "4000" },
        { code: "4000.03", name: "Pendapatan Software & Lisensi", category: "Pendapatan", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: true, parentCode: "4000" },
        { code: "4000.04", name: "Retur Penjualan", category: "Pendapatan", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: "4000" },
        { code: "4000.05", name: "Potongan Penjualan", category: "Pendapatan", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: "4000" },
        { code: "5000", name: "Beban Pokok Penjualan (HPP - Header)", category: "Beban Pokok (HPP)", normalBalance: "DEBIT", isPostable: false, isCash: false, isSystem: true, parentCode: null },
        { code: "5101", name: "HPP Project", category: "Beban Pokok (HPP)", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: "5000" },
        { code: "5102", name: "HPP Retail", category: "Beban Pokok (HPP)", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: "5000" },
        { code: "5104", name: "Selisih Inventaris (Stock Opname Loss)", category: "Beban Pokok (HPP)", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: "5000" },
        { code: "5105", name: "Kerusakan Barang (Inventory Damage)", category: "Beban Pokok (HPP)", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: "5000" },
        { code: "5106", name: "Selisih Harga Pembelian (PPV)", category: "Beban Pokok (HPP)", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: "5000" },
        { code: "6000", name: "EXPENSE (Header)", category: "Beban Operasional", normalBalance: "DEBIT", isPostable: false, isCash: false, isSystem: true, parentCode: null },
        { code: "6100", name: "Biaya pemasaran", category: "Beban Operasional", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: false, parentCode: "6000" },
        { code: "6200", name: "Biaya Umum & Administrasi", category: "Beban Operasional", normalBalance: "DEBIT", isPostable: false, isCash: false, isSystem: true, parentCode: "6000" },
        { code: "6201", name: "Gaji & Tunjangan", category: "Beban Operasional", normalBalance: "DEBIT", isPostable: false, isCash: false, isSystem: true, parentCode: "6200" },
        { code: "6201.01", name: "Biaya Gaji Karyawan", category: "Beban Operasional", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: "6201" },
        { code: "6201.05", name: "Beban BPJS Ketenagakerjaan & Kesehatan (Perusahaan)", category: "Beban Operasional", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: "6201" },
        { code: "6202", name: "Beban Operasional Lainnya", category: "Beban Operasional", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: false, parentCode: "6200" },
        { code: "7100", name: "Pendapatan Lain-lain", category: "Pendapatan Diluar Usaha", normalBalance: "KREDIT", isPostable: true, isCash: false, isSystem: false, parentCode: null },
        { code: "7200", name: "Beban Lain-lain", category: "Beban Diluar Usaha", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: false, parentCode: null },
        { code: "7201", name: "Beban Pajak Penghasilan Badan", category: "Beban Diluar Usaha", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: null },
        { code: "7202", name: "Selisih Pembulatan", category: "Beban Diluar Usaha", normalBalance: "DEBIT", isPostable: true, isCash: false, isSystem: true, parentCode: null },
      ];
      for (const c of defaultCoas) {
        await (this.main as any).coaAccount?.upsert({
          where: { code: c.code },
          update: {
            name: c.name,
            category: c.category,
            normalBalance: c.normalBalance,
            parentCode: c.parentCode,
            isPostable: c.isPostable,
            isCash: c.isCash,
            isSystem: c.isSystem,
          },
          create: { ...c, status: "AKTIF" },
        }).catch(() => {});
      }

      // Pastikan AccountMapping default tersedia
      const defaultMappings: Record<string, string> = {
        CASH_DEFAULT: "1000.02",
        AR: "110302",
        AR_RETENTION: "110303",
        AP: "210102",
        GRNI: "2108",
        INVENTORY: "1200",
        VAT_OUT: "2100",
        VAT_IN: "1600",
        REVENUE_PRODUCT: "4000.01",
        REVENUE_SERVICE: "4000.02",
        SALES_RETURN: "4000.04",
        SALES_DISCOUNT: "4000.05",
        COGS_PROJECT: "5101",
        COGS_RETAIL: "5102",
        CUSTOMER_DP: "210202",
        SUPPLIER_DP: "1100.02",
        STOCK_OPNAME_DIFF: "5104",
        STOCK_DAMAGE: "5105",
        PURCHASE_PRICE_VARIANCE: "5106",
        EXPENSE_PAYABLE: "2103",
        EXPENSE_DEFAULT: "6202",
        WAGES_EXPENSE: "6201.01",
        BPJS_EXPENSE: "6201.05",
        PPH21_PAYABLE: "2105",
        BPJS_PAYABLE: "2107",
        PREPAID_PPH23: "1105.01",
        PREPAID_PPH25: "1105.02",
        TAX_REFUND_RECEIVABLE: "1106",
        PPH23_PAYABLE: "2106",
        PPH29_PAYABLE: "2109",
        CIT_EXPENSE: "7201",
        RETAINED_EARNINGS: "3102",
        ROUNDING: "7202",
      };
      for (const [key, accountCode] of Object.entries(defaultMappings)) {
        await (this.main as any).accountMapping?.upsert({
          where: { key },
          update: { accountCode },
          create: { key, accountCode },
        }).catch(() => {});
      }
    } catch {}
  }

  async onApplicationShutdown() {
    await Promise.allSettled([this.main.$disconnect(), this.archive.$disconnect()]);
  }
}
