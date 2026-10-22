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
