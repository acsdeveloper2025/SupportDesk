import { forwardRef, Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { RbacModule } from "../rbac/rbac.module";
import { SlaModule } from "../sla/sla.module";
import { AttachmentsController } from "./attachments/attachments.controller";
import { AttachmentsRepository } from "./attachments/attachments.repository";
import { AttachmentsService } from "./attachments/attachments.service";
import { LocalAttachmentStorage } from "./attachments/local-attachment-storage";
import { NoOpVirusScanner, VIRUS_SCANNER } from "./attachments/virus-scanner";
import { CommentsController } from "./comments.controller";
import { CommentsRepository } from "./comments.repository";
import { CommentsService } from "./comments.service";
import { TicketsController } from "./tickets.controller";
import { TicketsRepository } from "./tickets.repository";
import { TicketsService } from "./tickets.service";

@Module({
  controllers: [TicketsController, CommentsController, AttachmentsController],
  exports: [
    TicketsService,
    TicketsRepository,
    CommentsService,
    CommentsRepository,
    AttachmentsService,
    AttachmentsRepository,
  ],
  imports: [
    DatabaseModule,
    AuthModule,
    RbacModule,
    NotificationsModule,
    forwardRef(() => SlaModule),
  ],
  providers: [
    TicketsService,
    TicketsRepository,
    CommentsService,
    CommentsRepository,
    AttachmentsService,
    AttachmentsRepository,
    LocalAttachmentStorage,
    {
      provide: VIRUS_SCANNER,
      useClass: NoOpVirusScanner,
    },
  ],
})
export class TicketsModule {}
