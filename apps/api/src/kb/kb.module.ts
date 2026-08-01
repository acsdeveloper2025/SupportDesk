import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { OutboxModule } from "../outbox/outbox.module";
import { RbacModule } from "../rbac/rbac.module";
import { KbArticlesController } from "./kb-articles.controller";
import { KbArticlesRepository } from "./kb-articles.repository";
import { KbArticlesService } from "./kb-articles.service";
import { KbCategoriesController } from "./kb-categories.controller";
import { KbCategoriesRepository } from "./kb-categories.repository";
import { KbCategoriesService } from "./kb-categories.service";

@Module({
  imports: [DatabaseModule, AuthModule, RbacModule, OutboxModule],
  controllers: [KbCategoriesController, KbArticlesController],
  providers: [KbCategoriesService, KbCategoriesRepository, KbArticlesService, KbArticlesRepository],
  exports: [KbCategoriesService, KbCategoriesRepository, KbArticlesService, KbArticlesRepository],
})
export class KbModule {}
