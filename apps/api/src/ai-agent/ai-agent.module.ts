import { Module } from "@nestjs/common";
import { ReportsModule } from "../reports/reports.module.js";
import { DashboardModule } from "../dashboard/dashboard.module.js";
import { AuditModule } from "../audit/audit.module.js";
import { CrmModule } from "../crm/crm.module.js";
import { CalendarModule } from "../calendar/calendar.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { MasterModule } from "../master/master.module.js";
import { FinanceModule } from "../finance/finance.module.js";
import { ProcurementModule } from "../procurement/procurement.module.js";
import { AiSettingsService } from "./ai-settings.service.js";
import { LlmProviderService } from "./llm-provider.service.js";
import { AiActionsService } from "./ai-actions.service.js";
import { AgentToolsService } from "./agent-tools.service.js";
import { AiAgentService } from "./ai-agent.service.js";
import { AiAgentController } from "./ai-agent.controller.js";

@Module({
  imports: [
    ReportsModule,
    DashboardModule,
    AuditModule,
    CrmModule,
    CalendarModule,
    ProjectsModule,
    MasterModule,
    FinanceModule,
    ProcurementModule,
  ],
  controllers: [AiAgentController],
  providers: [
    AiSettingsService,
    LlmProviderService,
    AiActionsService,
    AgentToolsService,
    AiAgentService,
  ],
  exports: [AiAgentService],
})
export class AiAgentModule {}
