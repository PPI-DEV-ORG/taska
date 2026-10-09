import { Module } from "@nestjs/common";
import { RequestsService } from "./requests.service.js";
import { RequestsController } from "./requests.controller.js";
import { PosService } from "./pos.service.js";
import { PosController } from "./pos.controller.js";
import { ReceivingsService } from "./receivings.service.js";
import { IssuesController, ReceivingsController } from "./receivings.controller.js";
import { ApprovalsModule } from "../approvals/approvals.module.js";
import { StockModule } from "../stock/stock.module.js";

@Module({
  imports: [ApprovalsModule, StockModule],
  providers: [RequestsService, PosService, ReceivingsService],
  controllers: [RequestsController, PosController, ReceivingsController, IssuesController],
  exports: [RequestsService, PosService, ReceivingsService],
})
export class ProcurementModule {}
