import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";

function adapter(url: string | undefined) {
  if (!url) throw new Error("DATABASE_URL tidak di-set");
  return new PrismaMariaDb(url);
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

  const settings: Array<{ key: string; value: string; description: string }> = [
    { key: "ambang.persetujuan", value: "10000000", description: "Ambang persetujuan lapis kedua (Rp)" },
    { key: "ppn.persen", value: "11", description: "PPN (%)" },
    { key: "nomor.penawaran", value: "PNW/YYYY/MM/NNN", description: "Format nomor penawaran" },
    { key: "nomor.clientPO", value: "POC/YYYY/MM/NNN", description: "Format nomor Client PO" },
    { key: "nomor.permintaan", value: "PNJ/YYYY/MM/NNN", description: "Format nomor permintaan pengadaan" },
    { key: "nomor.pesanan", value: "POD/YYYY/MM/NNN", description: "Format nomor pesanan pembelian" },
    { key: "nomor.suratJalan", value: "SJN/YYYY/MM/NNN", description: "Format nomor surat jalan" },
    { key: "nomor.penerimaan", value: "RCP/YYYY/MM/NNN", description: "Format nomor penerimaan" },
    { key: "nomor.pelanggan", value: "INV/YYYY/MM/NNN", description: "Format nomor invoice pelanggan" },
    { key: "nomor.supplier", value: "RNC/YYYY/MM/NNN", description: "Format nomor invoice supplier" },
    { key: "nomor.proyek", value: "PRJ/YYYY/NNN", description: "Format nomor proyek" },
    { key: "upload.maksimal.foto", value: "5242880", description: "Batas foto (5 MB)" },
    { key: "upload.maksimal.dokumen", value: "15728640", description: "Batas dokumen (15 MB)" },
    { key: "upload.maksimal.video", value: "26214400", description: "Batas video (25 MB)" },
  ];

  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value, description: s.description },
      create: { key: s.key, value: s.value, description: s.description, updatedById: bos.id },
    });
  }

  console.log(`Seed OK: ${bos.email} (id=${bos.id}) + ${settings.length} system setting`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
