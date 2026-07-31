import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { RbacModule } from "../rbac/rbac.module";
import { WorkflowsController } from "./workflows.controller";
import { WorkflowsRepository } from "./workflows.repository";
import { WorkflowsService } from "./workflows.service";

@Module({
  controllers: [WorkflowsController],
  exports: [WorkflowsService, WorkflowsRepository],
  imports: [DatabaseModule, AuthModule, RbacModule],
  providers: [WorkflowsRepository, WorkflowsService],
})
export class WorkflowsModule {}
