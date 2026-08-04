import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";
import { ZodError } from "zod";

import { getCorrelationId } from "../logging/correlation-id";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const correlationId = getCorrelationId(request);
    // Prisma P2023 ("Inconsistent column data") surfaces for malformed UUID
    // path/body values that can never reference a persisted row. Treat as
    // not-found instead of a 500 so clients get a stable, safe response.
    const isInvalidUuidInput =
      exception instanceof Error && (exception as { code?: string }).code === "P2023";
    const statusCode = isInvalidUuidInput
      ? HttpStatus.NOT_FOUND
      : exception instanceof ZodError
        ? HttpStatus.BAD_REQUEST
        : exception instanceof HttpException
          ? exception.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorBody = {
      error: {
        code: statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED",
        correlationId,
        message:
          statusCode >= 500
            ? "An unexpected error occurred."
            : "The request could not be completed.",
      },
      timestamp: new Date().toISOString(),
    };

    process.stderr.write(
      `${JSON.stringify({
        correlationId,
        level: "error",
        method: request.method,
        path: request.originalUrl,
        statusCode,
        timestamp: new Date().toISOString(),
        type: "error",
        detail: statusCode >= 500 && exception instanceof Error ? exception.message : undefined,
        stack:
          statusCode >= 500 && exception instanceof Error
            ? (exception.stack ?? "").split("\n").slice(0, 8).join(" | ")
            : undefined,
      })}\n`,
    );

    response.status(statusCode).json(errorBody);
  }
}
