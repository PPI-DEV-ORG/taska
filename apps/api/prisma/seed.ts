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

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});

