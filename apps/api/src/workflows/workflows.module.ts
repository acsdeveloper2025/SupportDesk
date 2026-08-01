import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { OutboxModule } from "../outbox/outbox.module";
import { RbacModule } from "../rbac/rbac.module";
import { WorkflowRuntimeModule } from "./runtime/workflow-runtime.module";
import { WorkflowValidationService } from "./workflow-validation.service";
import { WorkflowsController } from "./workflows.controller";
import { WorkflowsRepository } from "./workflows.repository";
import { WorkflowsService } from "./workflows.service";

@Module({
  controllers: [WorkflowsController],
  exports: [
    WorkflowsService,
    WorkflowsRepository,
    WorkflowValidationService,
    WorkflowRuntimeModule,
  ],
  imports: [DatabaseModule, AuthModule, RbacModule, OutboxModule, WorkflowRuntimeModule],
  providers: [WorkflowsRepository, WorkflowValidationService, WorkflowsService],
})
export class WorkflowsModule {}
