import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { HealthController } from "./health.controller";

@Module({
  controllers: [HealthController],
  imports: [DatabaseModule],
})
export class HealthModule {}
