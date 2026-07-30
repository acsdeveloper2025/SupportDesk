import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import { setCorrelationId } from "./correlation-id";

const correlationHeader = "x-correlation-id";

export class CorrelationIdMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const incoming = request.header(correlationHeader);
    const correlationId = incoming && incoming.trim().length > 0 ? incoming : randomUUID();

    setCorrelationId(request, correlationId);
    response.setHeader(correlationHeader, correlationId);

    next();
  }
}
