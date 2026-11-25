import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from "@nestjs/common";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";
import { AiAgentService } from "./ai-agent.service.js";
import { SendAiChatDto } from "./dto.js";

@Controller("ai-agent")
export class AiAgentController {
  constructor(private readonly service: AiAgentService) {}

  @Get("capabilities")
  capabilities(@CurrentUser() user: RequestUser) {
    return this.service.getCapabilities(user);
  }

  @Get("sessions")
  sessions(@CurrentUser() user: RequestUser) {
    return this.service.listSessions(user);
  }

  @Get("sessions/:id")
  session(@CurrentUser() user: RequestUser, @Param("id", ParseIntPipe) id: number) {
    return this.service.getSession(user, id);
  }

  @Delete("sessions/:id")
  deleteSession(@CurrentUser() user: RequestUser, @Param("id", ParseIntPipe) id: number) {
    return this.service.deleteSession(user, id);
  }

  @Post("chat")
  chat(@CurrentUser() user: RequestUser, @Body() dto: SendAiChatDto) {
    return this.service.chat(user, dto);
  }
}
