import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { RbacModule } from "../rbac/rbac.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationsRepository } from "./notifications.repository";
import { NotificationsService } from "./notifications.service";

@Module({
  controllers: [NotificationsController],
  exports: [NotificationsService, NotificationsRepository],
  imports: [DatabaseModule, AuthModule, RbacModule],
  providers: [NotificationsService, NotificationsRepository],
})
export class NotificationsModule {}
