export type HealthStatus = "ok" | "degraded" | "error";

export interface HealthResponse {
  service: string;
  status: HealthStatus;
  timestamp: string;
  correlationId: string;
}

export * from "./ticket.types";
