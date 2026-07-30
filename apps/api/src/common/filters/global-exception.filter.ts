import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";

import { getCorrelationId } from "../logging/correlation-id";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const correlationId = getCorrelationId(request);
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

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
      })}\n`,
    );

    response.status(statusCode).json(errorBody);
  }
}
