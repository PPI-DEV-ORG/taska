import { Module } from "@nestjs/common";
import { StockService } from "./stock.service.js";
import { MovementsService } from "./movements.service.js";
import { SerialsService } from "./serials.service.js";
import { OpnameService } from "./opname.service.js";
import { ReservationsService } from "./reservations.service.js";
import { DamagesService } from "./damages.service.js";
import {
  DamagesController,
  MovementsController,
  OpnamesController,
  ReservationsController,
  SerialsController,
  StockController,
} from "./stock.controller.js";
import { ApprovalsModule } from "../approvals/approvals.module.js";

@Module({
  imports: [ApprovalsModule],
  providers: [StockService, MovementsService, SerialsService, OpnameService, ReservationsService, DamagesService],
  controllers: [MovementsController, StockController, SerialsController, OpnamesController, ReservationsController, DamagesController],
  exports: [StockService, MovementsService, ReservationsService],
})
export class StockModule {}
