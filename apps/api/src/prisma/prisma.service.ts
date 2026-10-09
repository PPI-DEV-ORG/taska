import { Injectable, OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";

function makeClient(urlEnv: string): PrismaClient {
  const url = process.env[urlEnv];
  if (!url) throw new Error(`${urlEnv} tidak di-set`);
  return new PrismaClient({ adapter: new PrismaMariaDb(url) });
}

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

  async onModuleInit() {
    await Promise.all([this.main.$connect(), this.archive.$connect()]);
  }

  async onApplicationShutdown() {
    await Promise.allSettled([this.main.$disconnect(), this.archive.$disconnect()]);
  }
}
