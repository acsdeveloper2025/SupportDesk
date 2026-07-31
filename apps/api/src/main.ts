import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";

import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { CorrelationIdMiddleware } from "./common/logging/correlation-id.middleware";
import { RequestLoggerMiddleware } from "./common/logging/request-logger.middleware";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  });
  const correlationIdMiddleware = new CorrelationIdMiddleware();
  const requestLoggerMiddleware = new RequestLoggerMiddleware();

  app.use(correlationIdMiddleware.use.bind(correlationIdMiddleware));
  app.use(requestLoggerMiddleware.use.bind(requestLoggerMiddleware));
  app.useGlobalFilters(new GlobalExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle("SupportDesk API")
    .setDescription(
      "SupportDesk API surface for the bootstrapped platform and Authentication & Identity foundation.",
    )
    .setVersion("0.1.0")
    .addBearerAuth({
      bearerFormat: "JWT",
      scheme: "bearer",
      type: "http",
    })
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(process.env.SWAGGER_PATH ?? "/docs", app, swaggerDocument);

  const port = Number(process.env.API_PORT ?? 3001);
  const host = process.env.API_HOST ?? "0.0.0.0";

  await app.listen(port, host);
}

void bootstrap();
