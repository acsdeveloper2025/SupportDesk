import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import { OutboxRepository } from "./outbox.repository";

@Injectable()
export class OutboxCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxCleanupService.name);
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(private readonly outboxRepository: OutboxRepository) {}

  onModuleInit() {
    this.startWorker();
  }

  onModuleDestroy() {
    this.stopWorker();
  }

  startWorker(pollIntervalMs = 24 * 60 * 60 * 1000) {
    // Default 24 hours
    if (this.timer) return;
    this.logger.log(`Starting outbox cleanup worker (pollInterval=${pollIntervalMs}ms)`);

    // Run initial cleanup soon after startup (e.g., 10 seconds)
    setTimeout(() => {
      void this.poll();
    }, 10000);

    this.timer = setInterval(() => {
      void this.poll();
    }, pollIntervalMs);
  }

  private async poll(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      const deletedCount = await this.outboxRepository.cleanupOldEvents(30);
      if (deletedCount > 0) {
        this.logger.log(`Cleaned up ${deletedCount} PROCESSED outbox events older than 30 days.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Unhandled error in outbox cleanup loop: ${msg}`);
    } finally {
      this.isProcessing = false;
    }
  }

  stopWorker() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.log("Stopped outbox cleanup worker");
    }
  }
}
