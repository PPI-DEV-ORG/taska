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

  // ─── Customer & Lead Contoh dengan Tipe SI (Sistem Integrator) ───
  const customerSI = await prisma.customer.upsert({
    where: { id: 1 },
    update: {
      company: "PT Integrasi Sistem Solusindo",
      notes: "Sistem Integrator (SI) Partner",
    },
    create: {
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

  await prisma.lead.upsert({
    where: { id: 1 },
    update: {
      clientType: "SI" as any,
    },
    create: {
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
  console.log("Seed OK: Lead & Customer tipe SI (Sistem Integrator)");

  // ─── Contoh Project & Tugas dengan Deskripsi Detail ───
  const sampleProject = await prisma.project.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "Instalasi Jaringan & CCTV Kantor Pusat",
      type: "CUSTOMER",
      customer: { connect: { id: customerSI.id } },
      pic: { connect: { id: superAdmin.id } },
      startDate: new Date(),
      status: "BERJALAN",
      progress: 25,
    },
  });

  await prisma.task.upsert({
    where: { id: 1 },
    update: {
      description: "Tarik kabel UTP Cat6 dari ruang server lt 1 ke access point dan kamera CCTV lorong lt 2 & 3. Pastikan kabel diberi label penanda dan masuk ke dalam conduit.",
    },
    create: {
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

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});

