import dotenv from "dotenv";
dotenv.config({ path: new URL("../.env", import.meta.url) });
dotenv.config();
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

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
  console.log("Mengosongkan seluruh tabel database...");

  // Nonaktifkan pemeriksaan foreign key sementara
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0;");

  // Ambil semua nama tabel di database aktif (kecuali tabel migrasi Prisma)
  const tables: Array<{ TABLE_NAME: string }> = await prisma.$queryRawUnsafe(`
    SELECT TABLE_NAME 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() 
      AND TABLE_TYPE = 'BASE TABLE'
      AND TABLE_NAME != '_prisma_migrations';
  `);

  for (const { TABLE_NAME } of tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${TABLE_NAME}\`;`);
      console.log(`✓ Dikosongkan: ${TABLE_NAME}`);
    } catch (e: any) {
      console.warn(`! Gagal truncate ${TABLE_NAME}: ${e?.message}`);
    }
  }

  // Aktifkan kembali pemeriksaan foreign key
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1;");
  console.log("\nSelesai! Database telah bersih. Anda dapat menjalankan 'pnpm db:seed' untuk mengisi ulang data.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error saat mengosongkan database:", err);
  process.exit(1);
});
