import type { NextFunction, Request, Response } from "express";

import { getCorrelationId } from "./correlation-id";

export class RequestLoggerMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();
    const correlationId = getCorrelationId(request);

    response.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const logEvent = {
        correlationId,
        durationMs: Math.round(durationMs * 100) / 100,
        level: "info",
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        timestamp: new Date().toISOString(),
        type: "request",
      };

      process.stdout.write(`${JSON.stringify(logEvent)}\n`);
    });

    next();
  }
}
