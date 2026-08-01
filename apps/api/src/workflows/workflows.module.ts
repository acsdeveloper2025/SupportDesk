import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { RbacModule } from "../rbac/rbac.module";
import { WorkflowValidationService } from "./workflow-validation.service";
import { WorkflowsController } from "./workflows.controller";
import { WorkflowsRepository } from "./workflows.repository";
import { WorkflowsService } from "./workflows.service";

@Module({
  controllers: [WorkflowsController],
  exports: [WorkflowsService, WorkflowsRepository, WorkflowValidationService],
  imports: [DatabaseModule, AuthModule, RbacModule],
  providers: [WorkflowsRepository, WorkflowValidationService, WorkflowsService],
})
export class WorkflowsModule {}
