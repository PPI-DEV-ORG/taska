import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";
import { AiAgentService } from "./ai-agent.service.js";
import { SendAiChatDto, UpdateAiSettingsDto } from "./dto.js";

@Controller("ai-agent")
export class AiAgentController {
  constructor(private readonly service: AiAgentService) {}

  @Get("capabilities")
  capabilities(@CurrentUser() user: RequestUser) {
    return this.service.getCapabilities(user);
  }

  @Get("usage")
  usage(@CurrentUser() user: RequestUser) {
    return this.service.getUsage(user);
  }

  @Get("settings")
  getSettings(@CurrentUser() user: RequestUser) {
    return this.service.getSettings(user);
  }

  @Put("settings")
  updateSettings(@CurrentUser() user: RequestUser, @Body() dto: UpdateAiSettingsDto) {
    return this.service.updateSettings(user, dto);
  }

  @Post("settings/test")
  testSettings(@CurrentUser() user: RequestUser) {
    return this.service.testSettingsConnection(user);
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

  @Post("sessions/:id/compact")
  compactSession(@CurrentUser() user: RequestUser, @Param("id", ParseIntPipe) id: number) {
    return this.service.compactSession(user, id);
  }

  @Post("sessions/:id/undo")
  undoSession(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseIntPipe) id: number,
    @Body() body?: { messageId?: number },
  ) {
    const msgId =
      body?.messageId != null && Number.isFinite(Number(body.messageId))
        ? Number(body.messageId)
        : undefined;
    return this.service.undoLastTurn(user, id, msgId);
  }

  @Post("actions/:id/confirm")
  confirmAction(@CurrentUser() user: RequestUser, @Param("id", ParseIntPipe) id: number) {
    return this.service.confirmAction(user, id);
  }

  @Post("actions/:id/cancel")
  cancelAction(@CurrentUser() user: RequestUser, @Param("id", ParseIntPipe) id: number) {
    return this.service.cancelAction(user, id);
  }

  @Post("chat")
  chat(@CurrentUser() user: RequestUser, @Body() dto: SendAiChatDto) {
    return this.service.chat(user, dto);
  }

  @Post("chat/stream")
  async chatStream(
    @CurrentUser() user: RequestUser,
    @Body() dto: SendAiChatDto,
    @Res() res: Response,
  ) {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const writeEvent = (ev: unknown) => {
      if (res.writableEnded) return;
      res.write(`data: ${JSON.stringify(ev)}\n\n`);
    };

    try {
      await this.service.chatStream(user, dto, writeEvent);
    } catch (err) {
      writeEvent({
        type: "error",
        message: (err as Error)?.message || "Gagal memproses permintaan Asisten AI.",
      });
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  }
}
