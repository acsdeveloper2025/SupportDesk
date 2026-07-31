import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { RbacModule } from "../rbac/rbac.module";
import { TicketsController } from "./tickets.controller";
import { TicketsRepository } from "./tickets.repository";
import { TicketsService } from "./tickets.service";

@Module({
  controllers: [TicketsController],
  exports: [TicketsService, TicketsRepository],
  imports: [DatabaseModule, AuthModule, RbacModule],
  providers: [TicketsService, TicketsRepository],
})
export class TicketsModule {}
