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
      await db.$executeRawUnsafe(`ALTER TABLE \`User\` MODIFY COLUMN \`role\` ${ROLE_ENUM_SQL} NOT NULL`);
      await db.$executeRawUnsafe(`ALTER TABLE \`Notification\` MODIFY COLUMN \`targetRole\` ${ROLE_ENUM_SQL} NULL`);
      await db.$executeRawUnsafe(`ALTER TABLE \`ApprovalStep\` MODIFY COLUMN \`approverRole\` ${ROLE_ENUM_SQL} NOT NULL`);
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
    } catch {}
  }

  async onApplicationShutdown() {
    await Promise.allSettled([this.main.$disconnect(), this.archive.$disconnect()]);
  }
}
