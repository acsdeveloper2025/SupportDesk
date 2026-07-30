import { Module } from "@nestjs/common";

import { DatabaseHealthService } from "./database-health.service";
import { PrismaService } from "./prisma.service";

@Module({
  exports: [DatabaseHealthService, PrismaService],
  providers: [DatabaseHealthService, PrismaService],
})
export class DatabaseModule {}
