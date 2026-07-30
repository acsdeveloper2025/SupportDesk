import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";

@ApiTags("bootstrap")
@Controller()
export class AppController {
  @Get()
  @ApiOkResponse({
    description: "Bootstrap API root response.",
  })
  getRoot() {
    return {
      message: "SupportDesk API",
      status: "ok",
    };
  }
}
