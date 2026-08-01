import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import { WorkflowDispatcherService } from "../workflows/runtime/workflow-dispatcher.service";

@Injectable()
export class OutboxClaimerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxClaimerService.name);
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(private readonly dispatcher: WorkflowDispatcherService) {}

  onModuleInit() {
    this.startWorker();
  }

  onModuleDestroy() {
    this.stopWorker();
  }

  startWorker(pollIntervalMs = 500) {
    if (this.timer) return;
    this.logger.log(`Starting outbox claimer worker (pollInterval=${pollIntervalMs}ms)`);

    this.timer = setInterval(() => {
      void this.poll();
    }, pollIntervalMs);
  }

  private async poll(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      await this.dispatcher.processOutboxBatch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Unhandled error in outbox claimer loop: ${msg}`);
    } finally {
      this.isProcessing = false;
    }
  }

  stopWorker() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.log("Stopped outbox claimer worker");
    }
  }
}
