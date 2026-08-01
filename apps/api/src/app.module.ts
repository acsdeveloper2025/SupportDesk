import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { IdentityModule } from "./identity/identity.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { OutboxModule } from "./outbox/outbox.module";
import { RbacModule } from "./rbac/rbac.module";
import { SlaModule } from "./sla/sla.module";
import { TicketsModule } from "./ticketing/tickets.module";
import { WorkflowsModule } from "./workflows/workflows.module";

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    DatabaseModule,
    HealthModule,
    IdentityModule,
    NotificationsModule,
    OutboxModule,
    RbacModule,
    SlaModule,
    TicketsModule,
    WorkflowsModule,
  ],
})
export class AppModule {}
