import dotenv from "dotenv";
dotenv.config({ path: new URL("../.env", import.meta.url) });
dotenv.config();
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";

function adapter(url: string | undefined) {
  if (!url) throw new Error("DATABASE_URL tidak di-set");
  const u = new URL(url);
  if (!u.searchParams.has("allowPublicKeyRetrieval")) {
    u.searchParams.set("allowPublicKeyRetrieval", "true");
  }
  return new PrismaMariaDb(u.toString());
}

async function main() {
  const prisma = new PrismaClient({ adapter: adapter(process.env["DATABASE_URL"]) });

  // Pastikan kolom dan tabel baru ada sebelum query Prisma dilakukan (Railway / fresh db safety)
  const schemaPatches = [
    "ALTER TABLE `User` MODIFY COLUMN `role` ENUM('SUPER_ADMIN','ADMIN','BOS','SALES','PM','TEKNISI','PROCUREMENT','FINANCE','GUDANG','SE','HR') NOT NULL",
    "ALTER TABLE `Notification` MODIFY COLUMN `targetRole` ENUM('SUPER_ADMIN','ADMIN','BOS','SALES','PM','TEKNISI','PROCUREMENT','FINANCE','GUDANG','SE','HR') NULL",
    "ALTER TABLE `ApprovalStep` MODIFY COLUMN `approverRole` ENUM('SUPER_ADMIN','ADMIN','BOS','SALES','PM','TEKNISI','PROCUREMENT','FINANCE','GUDANG','SE','HR') NOT NULL",
    "ALTER TABLE `StockReservation` MODIFY COLUMN `projectId` INT NULL",
    "ALTER TABLE `StockReservation` ADD COLUMN `quotationId` INT NULL",
    "ALTER TABLE `StockReservation` ADD COLUMN `invoiceId` INT NULL",
    "ALTER TABLE `StockReservation` ADD COLUMN `purchaseRequestId` INT NULL",
    "ALTER TABLE `ProjectRequirement` ADD COLUMN `serials` TEXT NULL",
    "ALTER TABLE `PurchaseRequestItem` ADD COLUMN `serials` TEXT NULL",
    "ALTER TABLE `PurchaseRequest` ADD COLUMN `doFileId` INT NULL",
    "ALTER TABLE `Project` ADD COLUMN `boqFileId` INT NULL",
    "ALTER TABLE `Supplier` ADD COLUMN `taxStatus` VARCHAR(32) NOT NULL DEFAULT 'NON_PKP'",
    "CREATE TABLE IF NOT EXISTS `SupplierItemTag` (`id` INT NOT NULL AUTO_INCREMENT, `supplierId` INT NOT NULL, `itemName` VARCHAR(191) NOT NULL, `price` DECIMAL(18,2) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), INDEX `SupplierItemTag_supplierId_idx` (`supplierId`), INDEX `SupplierItemTag_itemName_idx` (`itemName`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
    "CREATE TABLE IF NOT EXISTS `Attendance` (`id` INT NOT NULL AUTO_INCREMENT, `userId` INT NOT NULL, `date` DATE NOT NULL, `checkIn` DATETIME(3) NULL, `checkOut` DATETIME(3) NULL, `status` VARCHAR(191) NOT NULL DEFAULT 'HADIR', `overtimeHours` DECIMAL(6,2) NOT NULL DEFAULT 0, `notes` VARCHAR(191) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), UNIQUE INDEX `Attendance_userId_date_key` (`userId`, `date`), INDEX `Attendance_date_idx` (`date`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
    "CREATE TABLE IF NOT EXISTS `SalaryConfig` (`userId` INT NOT NULL, `basicSalary` DECIMAL(18,2) NOT NULL DEFAULT 0, `allowance` DECIMAL(18,2) NOT NULL DEFAULT 0, `ptkp` VARCHAR(191) NOT NULL DEFAULT 'TK/0', `hasNpwp` BOOLEAN NOT NULL DEFAULT true, `pph21Rate` DECIMAL(6,3) NULL, `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`userId`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
    "CREATE TABLE IF NOT EXISTS `PayrollSlip` (`id` INT NOT NULL AUTO_INCREMENT, `period` VARCHAR(191) NOT NULL, `userId` INT NOT NULL, `basicSalary` DECIMAL(18,2) NOT NULL DEFAULT 0, `allowance` DECIMAL(18,2) NOT NULL DEFAULT 0, `overtimePay` DECIMAL(18,2) NOT NULL DEFAULT 0, `absentDeduct` DECIMAL(18,2) NOT NULL DEFAULT 0, `grossSalary` DECIMAL(18,2) NOT NULL DEFAULT 0, `bpjs` DECIMAL(18,2) NOT NULL DEFAULT 0, `pph21` DECIMAL(18,2) NOT NULL DEFAULT 0, `netSalary` DECIMAL(18,2) NOT NULL DEFAULT 0, `workDays` INT NOT NULL DEFAULT 0, `presentDays` INT NOT NULL DEFAULT 0, `absentDays` INT NOT NULL DEFAULT 0, `lateCount` INT NOT NULL DEFAULT 0, `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT', `paidAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), UNIQUE INDEX `PayrollSlip_period_userId_key` (`period`, `userId`), INDEX `PayrollSlip_period_idx` (`period`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
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
  ];
  for (const sql of schemaPatches) {
    await prisma.$executeRawUnsafe(sql).catch(() => {});
  }

  const passwordHash = await bcrypt.hash("taska123", 10);

  const bos = await prisma.user.upsert({
    where: { email: "hendra@taska.co.id" },
    update: { passwordHash },
    create: {
      email: "hendra@taska.co.id",
      passwordHash,
      name: "Hendra",
      position: "Owner",
      role: "BOS",
      status: "AKTIF",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@taska.co.id" },
    update: { passwordHash },
    create: {
      email: "admin@taska.co.id",
      passwordHash,
      name: "Admin",
      position: "Administrator",
      role: "ADMIN",
      status: "AKTIF",
    },
  });

  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@taska.co.id" },
    update: { passwordHash },
    create: {
      email: "superadmin@taska.co.id",
      passwordHash,
      name: "Super Admin",
      position: "Super Administrator",
      role: "SUPER_ADMIN",
      status: "AKTIF",
    },
  });

  console.log(`Seed OK: ${superAdmin.email} (SUPER_ADMIN, id=${superAdmin.id}), ${bos.email} (BOS, id=${bos.id}), ${admin.email} (ADMIN, id=${admin.id})`);

  // ─── Sumber Lead (LeadSource) sesuai PRD ───
  const leadSources = [
    "Social Media",
    "Website",
    "Cold Call",
    "Referral",
    "Event",
    "Distributor",
    "Other",
  ];
  for (const name of leadSources) {
    await prisma.leadSource.upsert({
      where: { name },
      update: {},
      create: { name, status: "AKTIF" },
    });
  }
  console.log(`Seed OK: ${leadSources.length} Sumber Lead`);

  // ─── Alasan Gagal / Lost (LostReason) sesuai PRD ───
  const lostReasons = [
    "Belum ada follow-up",
    "Client tidak ada kabar",
    "Sales/PM lupa follow-up",
    "Dibatalkan oleh client",
    "Harga terlalu tinggi",
    "Kalah spesifikasi",
    "Budget dibatalkan",
  ];
  for (const name of lostReasons) {
    await prisma.lostReason.upsert({
      where: { name },
      update: {},
      create: { name, status: "AKTIF" },
    });
  }
  console.log(`Seed OK: ${lostReasons.length} Alasan Gagal`);

  // ─── Jenis Aktivitas Kunjungan (VisitActivityType) sesuai PRD ───
  const visitActivityTypes = [
    "Product Introduction",
    "Product Presentation / Demo",
    "Business Meeting",
    "Project Coordination",
    "Negotiation",
    "Follow-up Meeting",
    "Other",
  ];
  for (const name of visitActivityTypes) {
    await prisma.visitActivityType.upsert({
      where: { name },
      update: {},
      create: { name, status: "AKTIF" },
    });
  }
  console.log(`Seed OK: ${visitActivityTypes.length} Jenis Aktivitas Kunjungan`);

  // ─── Kategori Pengeluaran (ExpenseCategory) sesuai PRD ───
  const expenseCategories = [
    "Bensin",
    "Makan",
    "Transport",
    "Akomodasi",
    "Parkir & Tol",
    "ATK & Operasional",
    "Lainnya",
  ];
  for (const name of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { name },
      update: {},
      create: { name, status: "AKTIF" },
    });
  }
  console.log(`Seed OK: ${expenseCategories.length} Kategori Pengeluaran`);

  // ─── Cost Center (CostCenter) sesuai PRD ───
  const costCenters = [
    "CC-001 - Operasional Umum",
    "CC-002 - Sales & Marketing",
    "CC-003 - Project & Survey",
    "CC-004 - Gudang & Logistik",
    "CC-005 - IT & R&D",
  ];
  for (const name of costCenters) {
    await prisma.costCenter.upsert({
      where: { name },
      update: {},
      create: { name, status: "AKTIF" },
    });
  }
  console.log(`Seed OK: ${costCenters.length} Cost Center`);

  // ─── Customer & Lead Contoh dengan Tipe SI (Sistem Integrator) ───
  const existingCustomersSI = await prisma.customer.findMany({
    where: { name: "PT Integrasi Sistem Solusindo" },
    orderBy: { id: "asc" },
  });
  let customerSI = existingCustomersSI[0];
  if (!customerSI) {
    customerSI = await prisma.customer.create({
      data: {
        name: "PT Integrasi Sistem Solusindo",
        company: "PT Integrasi Sistem Solusindo",
        pic: "Bambang Wijaya",
        email: "bambang@solusindo-si.co.id",
        phone: "08123456789",
        city: "Jakarta Barat",
        notes: "Sistem Integrator (SI) Partner",
        status: "AKTIF",
      },
    });
  }

  const existingLeadsSI = await prisma.lead.findMany({
    where: { name: "Pengadaan Access Control & CCTV Gedung" },
    orderBy: { id: "asc" },
  });
  if (existingLeadsSI.length === 0) {
    await prisma.lead.create({
      data: {
        name: "Pengadaan Access Control & CCTV Gedung",
        customer: { connect: { id: customerSI.id } },
        clientType: "SI" as any,
        contactName: "Bambang Wijaya",
        estimatedValue: 125000000,
        probability: 60,
        owner: { connect: { id: superAdmin.id } },
        need: "Kebutuhan paket integrasi CCTV dan Turnstile untuk klien SI",
        stage: "PROSPECTING",
      },
    });
  } else if (existingLeadsSI.length > 1) {
    const duplicateLeadIds = existingLeadsSI.slice(1).map((l) => l.id);
    await prisma.lead.deleteMany({ where: { id: { in: duplicateLeadIds } } }).catch(() => {});
  }
  console.log("Seed OK: Lead & Customer tipe SI (Sistem Integrator)");

  // ─── Contoh Project & Tugas dengan Deskripsi Detail ───
  const existingProjects = await prisma.project.findMany({
    where: { name: "Instalasi Jaringan & CCTV Kantor Pusat" },
    orderBy: { id: "asc" },
  });
  let sampleProject = existingProjects[0];
  if (!sampleProject) {
    sampleProject = await prisma.project.create({
      data: {
        name: "Instalasi Jaringan & CCTV Kantor Pusat",
        type: "CUSTOMER",
        customer: { connect: { id: customerSI.id } },
        pic: { connect: { id: superAdmin.id } },
        startDate: new Date(),
        status: "BERJALAN",
        progress: 25,
      },
    });
  } else if (existingProjects.length > 1) {
    const duplicateProjectIds = existingProjects.slice(1).map((p) => p.id);
    await prisma.task.deleteMany({ where: { projectId: { in: duplicateProjectIds } } }).catch(() => {});
    await prisma.project.deleteMany({ where: { id: { in: duplicateProjectIds } } }).catch(() => {});
  }

  if (existingCustomersSI.length > 1) {
    const duplicateCustIds = existingCustomersSI.slice(1).map((c) => c.id);
    await prisma.customer.deleteMany({ where: { id: { in: duplicateCustIds } } }).catch(() => {});
  }

  const existingTask = await prisma.task.findFirst({
    where: {
      projectId: sampleProject.id,
      name: "Penarikan Kabel UTP & Conduit Lantai 2-3",
    },
  });
  if (!existingTask) {
    await prisma.task.create({
      data: {
        project: { connect: { id: sampleProject.id } },
        name: "Penarikan Kabel UTP & Conduit Lantai 2-3",
        description: "Tarik kabel UTP Cat6 dari ruang server lt 1 ke access point dan kamera CCTV lorong lt 2 & 3. Pastikan kabel diberi label penanda dan masuk ke dalam conduit.",
        assignee: { connect: { id: superAdmin.id } },
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        priority: "TINGGI",
        status: "IN_PROGRESS",
        progress: 40,
      },
    });
  }
  console.log("Seed OK: Project Task dengan deskripsi instruksi kerja");

  // ─── Gudang Master (Warehouse) ───
  let wh = await prisma.warehouse.findFirst({ where: { name: "Gudang Utama Jakarta" } });
  if (!wh) {
    wh = await prisma.warehouse.create({
      data: {
        name: "Gudang Utama Jakarta",
        city: "Jakarta",
        status: "AKTIF",
      },
    });
  }
  console.log("Seed OK: Gudang Utama Jakarta");

  // ─── Master Kategori & Produk (Serialized vs Bulk Items) ───
  const categoriesData = [
    { name: "Kamera CCTV", prefix: "CAM", description: "Perangkat IP Camera, Dome, Bullet, PTZ & CCTV Analog" },
    { name: "Kabel & Jaringan", prefix: "CBL", description: "Kabel UTP Cat5e/Cat6, Fiber Optic, Patchcord, Pigtail" },
    { name: "Perekam (NVR/DVR)", prefix: "NVR", description: "Network Video Recorder, Digital Video Recorder, HDD Surveillance" },
    { name: "Switch & Networking", prefix: "NET", description: "PoE Switch, Gigabit Switch, Router, Access Point WiFi" },
    { name: "Akses Kontrol & Biometrik", prefix: "ACS", description: "Mesin Absensi, Face Recognition, RFID Reader, Magnetic Lock, Dropbolt" },
    { name: "Power & Kelistrikan", prefix: "PWR", description: "Power Supply Box, Adaptor 12V, UPS Backup, PDU Rak" },
    { name: "Aksesoris & Konektor", prefix: "ACC", description: "Konektor RJ45, BNC, DC Jack, Sambungan FO, Cable Ties, Box Panel" },
    { name: "Pipa Conduit & Tray", prefix: "CND", description: "Pipa Conduit 20mm, Flexible Conduit, Tray Kabel, Klem & Soket" },
    { name: "Server & Storage", prefix: "SRV", description: "Server Rakmount, NAS Storage, Harddisk Enterprise, Rak Server" },
    { name: "Perlengkapan & Tools", prefix: "TLS", description: "Crimping Tool, Tang Kupas, OTDR/Optical Power Meter, Tangga, Tester" },
  ];

  const catMap = new Map<string, number>();
  for (const c of categoriesData) {
    const saved = await prisma.productCategory.upsert({
      where: { name: c.name },
      update: { prefix: c.prefix, description: c.description },
      create: { name: c.name, prefix: c.prefix, description: c.description, status: "AKTIF" },
    });
    catMap.set(c.name, saved.id);
  }

  const sampleProducts = [
    {
      sku: "CAM-UNV-4K",
      name: "IP Camera 4MP Bullet UNV",
      brand: "Uniview",
      description: "IP Camera Outdoor 4MP, IR 30m, PoE, WDR",
      categoryName: "Kamera CCTV",
      unit: "unit",
      hasSerial: true,
      minStock: 5,
      warrantyMonths: 24,
      purchasePrice: 750000,
    },
    {
      sku: "CAM-HIK-2MP",
      name: "IP Camera 2MP Dome Hikvision",
      brand: "Hikvision",
      description: "IP Camera Indoor 2MP Dome, IR 20m, PoE",
      categoryName: "Kamera CCTV",
      unit: "unit",
      hasSerial: true,
      minStock: 5,
      warrantyMonths: 12,
      purchasePrice: 500000,
    },
    {
      sku: "CBL-CAT6-BELDEN",
      name: "Kabel UTP Cat6 305M Belden",
      brand: "Belden",
      description: "Kabel UTP Cat6 23AWG 1 roll 305 meter",
      categoryName: "Kabel & Jaringan",
      unit: "roll",
      hasSerial: false,
      minStock: 3,
      warrantyMonths: 0,
      purchasePrice: 1850000,
    },
    {
      sku: "CBL-FO-4C",
      name: "Kabel Fiber Optic 4 Core Dropcore",
      brand: "Fiberstar",
      description: "Kabel Dropcore Single Mode 4 Core per meter",
      categoryName: "Kabel & Jaringan",
      unit: "meter",
      hasSerial: false,
      minStock: 200,
      warrantyMonths: 0,
      purchasePrice: 2500,
    },
    {
      sku: "ACC-RJ45-COMM",
      name: "Konektor RJ45 Cat6 Commscope",
      brand: "Commscope",
      description: "Konektor RJ45 Cat6 Original 100 pcs per box",
      categoryName: "Aksesoris & Konektor",
      unit: "box",
      hasSerial: false,
      minStock: 2,
      warrantyMonths: 0,
      purchasePrice: 250000,
    },
  ];

  for (const p of sampleProducts) {
    const categoryId = catMap.get(p.categoryName);
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        brand: p.brand,
        description: p.description,
        categoryId,
        unit: p.unit,
        hasSerial: p.hasSerial,
        minStock: p.minStock,
        warrantyMonths: p.warrantyMonths,
        purchasePrice: p.purchasePrice,
      },
      create: {
        sku: p.sku,
        name: p.name,
        brand: p.brand,
        description: p.description,
        categoryId,
        unit: p.unit,
        hasSerial: p.hasSerial,
        minStock: p.minStock,
        warrantyMonths: p.warrantyMonths,
        purchasePrice: p.purchasePrice,
        status: "AKTIF",
      },
    });
  }
  console.log(`Seed OK: ${sampleProducts.length} Produk Master (Serialized & Bulk)`);

  // Pastikan kolom baru Pengadaan & Non-Master Barang tersedia di DB
  const alterSqls = [
    "ALTER TABLE `PurchaseRequest` ADD COLUMN `procurementSource` VARCHAR(64) NULL DEFAULT 'SUPPLIER'",
    "ALTER TABLE `PurchaseRequest` ADD COLUMN `paymentMethod` VARCHAR(64) NULL DEFAULT 'UTANG'",
    "ALTER TABLE `PurchaseRequestItem` MODIFY COLUMN `productId` INT NULL",
    "ALTER TABLE `PurchaseRequestItem` ADD COLUMN `customName` VARCHAR(191) NULL",
    "ALTER TABLE `PurchaseRequestItem` ADD COLUMN `customUnit` VARCHAR(64) NULL",
    "ALTER TABLE `SupplierPOItem` MODIFY COLUMN `productId` INT NULL",
    "ALTER TABLE `SupplierPOItem` ADD COLUMN `customName` VARCHAR(191) NULL",
    "ALTER TABLE `SupplierPOItem` ADD COLUMN `customUnit` VARCHAR(64) NULL",
  ];
  for (const sql of alterSqls) {
    await prisma.$executeRawUnsafe(sql).catch(() => {});
  }

  // ─── Bagan Akun Standar (Chart of Accounts / COA dengan Hierarki Parent) ───
  const defaultCoaList: Array<{
    code: string;
    name: string;
    category: string;
    normalBalance: string;
    type?: string;
    parentCode?: string;
  }> = [
    { code: "1000", name: "Kas & Bank (Header)", category: "Aset Lancar", normalBalance: "DEBIT" },
    { code: "1000.01", name: "Kas Kecil", category: "Aset Lancar", normalBalance: "DEBIT", type: "cash/bank", parentCode: "1000" },
    { code: "1000.02", name: "Bank Mandiri PT GMP", category: "Aset Lancar", normalBalance: "DEBIT", type: "cash/bank", parentCode: "1000" },
    { code: "1100", name: "Piutang (Header)", category: "Aset Lancar", normalBalance: "DEBIT" },
    { code: "1100.02", name: "Uang Muka Pembelian", category: "Aset Lancar", normalBalance: "DEBIT", type: "account receivable", parentCode: "1100" },
    { code: "110302", name: "Account Receivable (Piutang Usaha)", category: "Aset Lancar", normalBalance: "DEBIT", type: "account receivable", parentCode: "1100" },
    { code: "1105", name: "Uang Muka PPh / Pajak Dibayar Dimuka", category: "Aset Lancar", normalBalance: "DEBIT", type: "other current asset", parentCode: "1100" },
    { code: "1200", name: "Persediaan barang dagang", category: "Aset Lancar", normalBalance: "DEBIT", type: "inventory" },
    { code: "1300", name: "Perlengkapan", category: "Aset Lancar", normalBalance: "DEBIT", type: "other current asset" },
    { code: "1600", name: "Ppn masukan", category: "Aset Lancar", normalBalance: "DEBIT", type: "other current asset" },
    { code: "2000", name: "Hutang (Header)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT" },
    { code: "2100", name: "Ppn Keluaran", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", type: "other current liability", parentCode: "2000" },
    { code: "210102", name: "Account Payable (Hutang Usaha)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", type: "account payable", parentCode: "2000" },
    { code: "210202", name: "Advance Sales (Uang Muka Penjualan)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", type: "account payable", parentCode: "2000" },
    { code: "2103", name: "Hutang Biaya & Reimbursement Operasional", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", parentCode: "2000" },
    { code: "2104", name: "Hutang PPh Potong / Pungut", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", parentCode: "2000" },
    { code: "2105", name: "Hutang PPh Pasal 21 (Karyawan)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", type: "other current liability", parentCode: "2000" },
    { code: "2106", name: "Hutang PPh Pasal 23 (Jasa / Vendor)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", type: "other current liability", parentCode: "2000" },
    { code: "2107", name: "Hutang BPJS Karyawan", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", type: "other current liability", parentCode: "2000" },
    { code: "3000", name: "Modal (Header)", category: "Ekuitas", normalBalance: "KREDIT" },
    { code: "310001", name: "OPENING BALANCE EQUITY", category: "Ekuitas", normalBalance: "KREDIT", type: "equity", parentCode: "3000" },
    { code: "3200.02", name: "Dividend", category: "Ekuitas", normalBalance: "KREDIT", type: "equity", parentCode: "3000" },
    { code: "3102", name: "Laba Ditahan / Laba Bersih Tahun Berjalan", category: "Ekuitas", normalBalance: "KREDIT", parentCode: "3000" },
    { code: "4000", name: "Pendapatan (Header)", category: "Pendapatan", normalBalance: "KREDIT" },
    { code: "4000.01", name: "Penjualan", category: "Pendapatan", normalBalance: "KREDIT", type: "revenue", parentCode: "4000" },
    { code: "4000.02", name: "Pendapatan jasa", category: "Pendapatan", normalBalance: "KREDIT", type: "revenue", parentCode: "4000" },
    { code: "4000.03", name: "Pendapatan software dan lisensi", category: "Pendapatan", normalBalance: "KREDIT", type: "revenue", parentCode: "4000" },
    { code: "4000.04", name: "Retur penjualan", category: "Pendapatan", normalBalance: "DEBIT", type: "revenue", parentCode: "4000" },
    { code: "4000.05", name: "Potongan penjualan", category: "Pendapatan", normalBalance: "DEBIT", type: "revenue", parentCode: "4000" },
    { code: "5000", name: "Beban Pokok Penjualan (HPP - Header)", category: "Beban Pokok (HPP)", normalBalance: "DEBIT" },
    { code: "5101", name: "HPP Project (Pengadaan Barang & Material Proyek)", category: "Beban Pokok (HPP)", normalBalance: "DEBIT", parentCode: "5000" },
    { code: "5102", name: "HPP Retail (Harga Pokok Penjualan Barang Stok)", category: "Beban Pokok (HPP)", normalBalance: "DEBIT", parentCode: "5000" },
    { code: "6000", name: "EXPENSE (Header)", category: "Beban Operasional", normalBalance: "DEBIT" },
    { code: "6100", name: "Biaya pemasaran", category: "Beban Operasional", normalBalance: "DEBIT", type: "expense", parentCode: "6000" },
    { code: "6101", name: "Biaya iklan", category: "Beban Operasional", normalBalance: "DEBIT", type: "expense", parentCode: "6100" },
    { code: "6102", name: "Biaya komisi", category: "Beban Operasional", normalBalance: "DEBIT", type: "expense", parentCode: "6100" },
    { code: "6103", name: "Biaya entertain", category: "Beban Operasional", normalBalance: "DEBIT", type: "expense", parentCode: "6100" },
    { code: "6200", name: "Biaya Umum & Administrasi", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6000" },
    { code: "6201", name: "Gaji & Tunjangan", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6200" },
    { code: "6201.01", name: "Biaya gaji", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6201" },
    { code: "6201.02", name: "Biaya transport karyawan", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6201" },
    { code: "6201.03", name: "Biaya catering & Makan karyawan", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6201" },
    { code: "6201.04", name: "Biaya THR", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6201" },
    { code: "6202", name: "Beban Utility", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6200" },
    { code: "6202.01", name: "Biaya Listrik", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6202" },
    { code: "6202.02", name: "Biaya PAM", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6202" },
    { code: "6202.03", name: "Biaya Telekomunikasi", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6202" },
    { code: "6202.04", name: "Biaya Pajak", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6202" },
    { code: "6202.05", name: "Biaya Retribusi & sumbangan", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6202" },
    { code: "6202.06", name: "Biaya ATK", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6202" },
    { code: "6202.07", name: "Biaya Umum & Adm lainnya", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6202" },
    { code: "6202.08", name: "Beban Reimburse", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6202" },
    { code: "6203", name: "Repair & maintenance expense", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6200" },
    { code: "6203.01", name: "pemeliharaan gedung", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6203" },
    { code: "6203.02", name: "pemeliharaan kendaraan", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6203" },
    { code: "7100", name: "Pendapatan diluar usaha", category: "Pendapatan Diluar Usaha", normalBalance: "KREDIT" },
    { code: "7100.01", name: "Pendapatan bunga deposito", category: "Pendapatan Diluar Usaha", normalBalance: "KREDIT", parentCode: "7100" },
    { code: "7100.02", name: "penjualan inventory / perlengkapan", category: "Pendapatan Diluar Usaha", normalBalance: "KREDIT", parentCode: "7100" },
    { code: "7100.03", name: "pendapatan lain-lain", category: "Pendapatan Diluar Usaha", normalBalance: "KREDIT", parentCode: "7100" },
    { code: "7200", name: "Biaya diluar usaha", category: "Beban Diluar Usaha", normalBalance: "DEBIT" },
    { code: "7200.01", name: "biaya adm bank", category: "Beban Diluar Usaha", normalBalance: "DEBIT", parentCode: "7200" },
    { code: "7200.02", name: "beban lain-lain", category: "Beban Diluar Usaha", normalBalance: "DEBIT", parentCode: "7200" },
  ];

  for (const c of defaultCoaList) {
    await (prisma as any).coaAccount.upsert({
      where: { code: c.code },
      update: {
        name: c.name,
        category: c.category,
        normalBalance: c.normalBalance,
        type: c.type ?? null,
        parentCode: c.parentCode ?? null,
      },
      create: {
        code: c.code,
        name: c.name,
        category: c.category,
        normalBalance: c.normalBalance,
        type: c.type ?? null,
        parentCode: c.parentCode ?? null,
        status: "AKTIF",
      },
    });
  }
  console.log(`Seed OK: ${defaultCoaList.length} Bagan Akun (COA) dengan relasi parentCode`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});

