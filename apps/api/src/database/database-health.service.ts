import { Injectable } from "@nestjs/common";

import { PrismaService } from "./prisma.service";

@Injectable()
export class DatabaseHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<{ status: "ok" | "not_configured" | "error"; message: string }> {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      return {
        message: "DATABASE_URL is not configured.",
        status: "not_configured",
      };
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        message: "Database connection verified.",
        status: "ok",
      };
    } catch {
      return {
        message: "Database connection failed.",
        status: "error",
      };
    }
  }
}
