import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service.js";

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  health() {
    return {
      name: "Akuntra Mini ERP API",
      status: "ok",
      version: "0.1.0",
      time: new Date().toISOString(),
    };
  }

  async readiness() {
    try {
      await this.prisma.main.$queryRaw`SELECT 1`;
      return {
        name: "Akuntra Mini ERP API",
        status: "ok",
        db: "up",
        time: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        name: "Akuntra Mini ERP API",
        status: "degraded",
        db: "down",
        time: new Date().toISOString(),
      });
    }
  }
}
