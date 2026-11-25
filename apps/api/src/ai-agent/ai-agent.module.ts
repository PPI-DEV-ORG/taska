import { Module } from "@nestjs/common";
import { ReportsModule } from "../reports/reports.module.js";
import { DashboardModule } from "../dashboard/dashboard.module.js";
import { AuditModule } from "../audit/audit.module.js";
import { LlmProviderService } from "./llm-provider.service.js";
import { AgentToolsService } from "./agent-tools.service.js";
import { AiAgentService } from "./ai-agent.service.js";
import { AiAgentController } from "./ai-agent.controller.js";

@Module({
  imports: [ReportsModule, DashboardModule, AuditModule],
  controllers: [AiAgentController],
  providers: [LlmProviderService, AgentToolsService, AiAgentService],
  exports: [AiAgentService],
})
export class AiAgentModule {}
