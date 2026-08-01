import { forwardRef, Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { RbacModule } from "../rbac/rbac.module";
import { TicketsModule } from "../ticketing/tickets.module";
import { BusinessSchedulesController } from "./business-schedules.controller";
import { BusinessSchedulesService } from "./business-schedules.service";
import { SlaRepository } from "./sla.repository";
import { SlaEngineService } from "./sla-engine.service";
import { SlaPoliciesController } from "./sla-policies.controller";
import { SlaPoliciesService } from "./sla-policies.service";
import { SlaQueryController } from "./sla-query.controller";

@Module({
  controllers: [BusinessSchedulesController, SlaPoliciesController, SlaQueryController],
  exports: [SlaEngineService, SlaRepository, BusinessSchedulesService, SlaPoliciesService],
  imports: [
    DatabaseModule,
    AuthModule,
    RbacModule,
    NotificationsModule,
    forwardRef(() => TicketsModule),
  ],
  providers: [SlaRepository, BusinessSchedulesService, SlaPoliciesService, SlaEngineService],
})
export class SlaModule {}
