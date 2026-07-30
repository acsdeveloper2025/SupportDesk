import { Module } from "@nestjs/common";

import { DatabaseHealthService } from "./database-health.service";

@Module({
  exports: [DatabaseHealthService],
  providers: [DatabaseHealthService],
})
export class DatabaseModule {}
