import { forwardRef, Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { RbacModule } from "../rbac/rbac.module";
import { WorkflowRuntimeModule } from "../workflows/runtime/workflow-runtime.module";
import { AdminOutboxController } from "./admin-outbox.controller";
import { OutboxRepository } from "./outbox.repository";
import { OutboxPublisherService } from "./outbox-publisher.service";

@Module({
  controllers: [AdminOutboxController],
  imports: [DatabaseModule, AuthModule, RbacModule, forwardRef(() => WorkflowRuntimeModule)],
  providers: [OutboxPublisherService, OutboxRepository, OutboxClaimerService],
  exports: [OutboxPublisherService, OutboxRepository, OutboxClaimerService],
})
export class OutboxModule {}
