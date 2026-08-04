import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { OutboxModule } from "../outbox/outbox.module";
import { RbacModule } from "../rbac/rbac.module";
import { LocalAttachmentStorage } from "../ticketing/attachments/local-attachment-storage";
import { NoOpVirusScanner, VIRUS_SCANNER } from "../ticketing/attachments/virus-scanner";
import { AssetAttachmentsController } from "./asset-attachments.controller";
import { AssetAttachmentsService } from "./asset-attachments.service";
import { AssetCategoriesController } from "./asset-categories.controller";
import { AssetCategoriesRepository } from "./asset-categories.repository";
import { AssetLocationsController } from "./asset-locations.controller";
import { AssetLocationsRepository } from "./asset-locations.repository";
import { AssetTypesController } from "./asset-types.controller";
import { AssetTypesRepository } from "./asset-types.repository";
import { AssetsController } from "./assets.controller";
import { AssetsRepository } from "./assets.repository";
import { AssetsService } from "./assets.service";

@Module({
  imports: [DatabaseModule, AuthModule, RbacModule, OutboxModule],
  controllers: [
    AssetTypesController,
    AssetCategoriesController,
    AssetLocationsController,
    AssetAttachmentsController,
    AssetsController,
  ],
  providers: [
    AssetsService,
    AssetsRepository,
    AssetTypesRepository,
    AssetCategoriesRepository,
    AssetLocationsRepository,
    AssetAttachmentsService,
    LocalAttachmentStorage,
    {
      provide: VIRUS_SCANNER,
      useClass: NoOpVirusScanner,
    },
  ],
  exports: [AssetsService, AssetsRepository],
})
export class AssetsModule {}
