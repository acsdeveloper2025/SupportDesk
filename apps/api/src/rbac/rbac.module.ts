import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { PrismaRbacRepository, RbacRepository } from "./rbac.repository";
import { RbacService } from "./rbac.service";

@Module({
  exports: [RbacService],
  imports: [DatabaseModule],
  providers: [
    RbacService,
    {
      provide: RbacRepository,
      useClass: PrismaRbacRepository,
    },
  ],
})
export class RbacModule {}
