import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class DatabaseHealthService {
  async check(): Promise<{ status: "ok" | "not_configured" | "error"; message: string }> {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      return {
        message: "DATABASE_URL is not configured.",
        status: "not_configured",
      };
    }

    const prisma = new PrismaClient();

    try {
      await prisma.$connect();

      return {
        message: "Database connection verified.",
        status: "ok",
      };
    } catch {
      return {
        message: "Database connection failed.",
        status: "error",
      };
    } finally {
      await prisma.$disconnect();
    }
  }
}
