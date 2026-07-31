import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { RbacModule } from "../rbac/rbac.module";
import { CommentsController } from "./comments.controller";
import { CommentsRepository } from "./comments.repository";
import { CommentsService } from "./comments.service";
import { TicketsController } from "./tickets.controller";
import { TicketsRepository } from "./tickets.repository";
import { TicketsService } from "./tickets.service";

@Module({
  controllers: [TicketsController, CommentsController],
  exports: [TicketsService, TicketsRepository, CommentsService, CommentsRepository],
  imports: [DatabaseModule, AuthModule, RbacModule],
  providers: [TicketsService, TicketsRepository, CommentsService, CommentsRepository],
})
export class TicketsModule {}
