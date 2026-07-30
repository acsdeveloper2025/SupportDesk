import type { Request } from "express";

type RequestWithCorrelation = Request & {
  correlationId?: string;
};

export function getCorrelationId(request: Request): string {
  return (request as RequestWithCorrelation).correlationId ?? "unknown";
}

export function setCorrelationId(request: Request, correlationId: string): void {
  (request as RequestWithCorrelation).correlationId = correlationId;
}
