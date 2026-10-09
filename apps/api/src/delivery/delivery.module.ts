import { Module } from "@nestjs/common";
import { DeliveryService } from "./delivery.service.js";
import { DeliveryController } from "./delivery.controller.js";
import { ApprovalsModule } from "../approvals/approvals.module.js";
import { StockModule } from "../stock/stock.module.js";

@Module({
  imports: [ApprovalsModule, StockModule],
  providers: [DeliveryService],
  controllers: [DeliveryController],
  exports: [DeliveryService],
})
export class DeliveryModule {}
