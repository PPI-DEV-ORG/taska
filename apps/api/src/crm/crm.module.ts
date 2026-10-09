import { Module } from "@nestjs/common";
import { LeadsService } from "./leads.service.js";
import { LeadsController } from "./leads.controller.js";
import { FollowUpsService } from "./follow-ups.service.js";
import { FollowUpsController } from "./follow-ups.controller.js";
import { SurveysService } from "./surveys.service.js";
import { SurveysController } from "./surveys.controller.js";
import { QuotationsService } from "./quotations.service.js";
import { QuotationsController } from "./quotations.controller.js";
import { ApprovalsModule } from "../approvals/approvals.module.js";

@Module({
  imports: [ApprovalsModule],
  providers: [LeadsService, FollowUpsService, SurveysService, QuotationsService],
  controllers: [LeadsController, FollowUpsController, SurveysController, QuotationsController],
  exports: [LeadsService, QuotationsService],
})
export class CrmModule {}
