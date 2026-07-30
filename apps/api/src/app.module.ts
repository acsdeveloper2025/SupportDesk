import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { IdentityModule } from "./identity/identity.module";
import { RbacModule } from "./rbac/rbac.module";

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
    RbacModule,
  ],
})
export class AppModule {}
