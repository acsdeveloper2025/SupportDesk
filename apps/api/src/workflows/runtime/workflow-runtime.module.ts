import { forwardRef, Module } from "@nestjs/common";

import { DatabaseModule } from "../../database/database.module";
import { OutboxModule } from "../../outbox/outbox.module";
import { AddCommentActionExecutor } from "./action-executors/add-comment-action.executor";
import { AssignActionExecutor } from "./action-executors/assign-action.executor";
import { ChangeAssetStatusActionExecutor } from "./action-executors/change-asset-status-action.executor";
import { ChangeStatusActionExecutor } from "./action-executors/change-status-action.executor";
import { CreateNotificationActionExecutor } from "./action-executors/create-notification-action.executor";
import { SlaActionExecutor } from "./action-executors/sla-action.executor";
import { WorkflowDispatcherService } from "./workflow-dispatcher.service";
import { WorkflowExecutorService } from "./workflow-executor.service";

@Module({
  imports: [DatabaseModule, forwardRef(() => OutboxModule)],
  providers: [
    ChangeStatusActionExecutor,
    ChangeAssetStatusActionExecutor,
    AssignActionExecutor,
    AddCommentActionExecutor,
    CreateNotificationActionExecutor,
    SlaActionExecutor,
    WorkflowExecutorService,
    WorkflowDispatcherService,
  ],
  exports: [WorkflowDispatcherService, WorkflowExecutorService],
})
export class WorkflowRuntimeModule {}
