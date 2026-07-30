import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { IdentityLookupService } from "./identity-lookup.service";

@Module({
  exports: [IdentityLookupService],
  imports: [DatabaseModule],
  providers: [IdentityLookupService],
})
export class IdentityModule {}
