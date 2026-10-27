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

const ROLE_ENUM_SQL = "ENUM('SUPER_ADMIN','ADMIN','BOS','SALES','PM','TEKNISI','PROCUREMENT','FINANCE','GUDANG','SE')";

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
