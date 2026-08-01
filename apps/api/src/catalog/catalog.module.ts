import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { KbModule } from "../kb/kb.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OutboxModule } from "../outbox/outbox.module";
import { RbacModule } from "../rbac/rbac.module";
import { SlaModule } from "../sla/sla.module";
import { LocalAttachmentStorage } from "../ticketing/attachments/local-attachment-storage";
import { NoOpVirusScanner, VIRUS_SCANNER } from "../ticketing/attachments/virus-scanner";
import { CatalogCategoriesController } from "./catalog-categories.controller";
import { CatalogCategoriesRepository } from "./catalog-categories.repository";
import { CatalogCategoriesService } from "./catalog-categories.service";
import { CatalogRequestsController } from "./catalog-requests.controller";
import { CatalogRequestsRepository } from "./catalog-requests.repository";
import { CatalogRequestsService } from "./catalog-requests.service";
import { CatalogServicesController } from "./catalog-services.controller";
import { CatalogServicesRepository } from "./catalog-services.repository";
import { CatalogServicesService } from "./catalog-services.service";
import { CatalogTemplatesRepository } from "./catalog-templates.repository";

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    RbacModule,
    OutboxModule,
    NotificationsModule,
    SlaModule,
    KbModule,
  ],
  controllers: [CatalogCategoriesController, CatalogServicesController, CatalogRequestsController],
  providers: [
    CatalogCategoriesService,
    CatalogCategoriesRepository,
    CatalogServicesService,
    CatalogServicesRepository,
    CatalogRequestsService,
    CatalogRequestsRepository,
    CatalogTemplatesRepository,
    LocalAttachmentStorage,
    {
      provide: VIRUS_SCANNER,
      useClass: NoOpVirusScanner,
    },
  ],
  exports: [
    CatalogCategoriesService,
    CatalogCategoriesRepository,
    CatalogServicesService,
    CatalogServicesRepository,
    CatalogRequestsService,
    CatalogRequestsRepository,
    CatalogTemplatesRepository,
  ],
})
export class CatalogModule {}
