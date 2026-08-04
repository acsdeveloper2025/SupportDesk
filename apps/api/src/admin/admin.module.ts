import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { RbacModule } from "../rbac/rbac.module";
import { AdminService } from "./admin.service";
import { AuditAdminController } from "./audit-admin.controller";
import { GlobalAdminController } from "./global-admin.controller";
import { NotificationAdminController } from "./notification-admin.controller";
import { OutboxAdminController } from "./outbox-admin.controller";
import { RoleAdminController } from "./role-admin.controller";
import { SlaAdminController } from "./sla-admin.controller";
import { SystemHealthAdminController } from "./system-health-admin.controller";
import { TenantAdminController } from "./tenant-admin.controller";
import { UserAdminController } from "./user-admin.controller";
import { WorkflowAdminController } from "./workflow-admin.controller";

@Module({
  imports: [DatabaseModule, RbacModule, AuthModule],
  controllers: [
    GlobalAdminController,
    TenantAdminController,
    UserAdminController,
    RoleAdminController,
    WorkflowAdminController,
    OutboxAdminController,
    SlaAdminController,
    NotificationAdminController,
    AuditAdminController,
    SystemHealthAdminController,
  ],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
