import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ContractsService } from "./contracts.service.js";
import {
  ContractAmendmentDto,
  ContractApprovalDecisionDto,
  ContractDocumentDto,
  ContractDocumentVersionDto,
  ContractPaymentScheduleInputDto,
  ContractQuery,
  ContractRelationInputDto,
  ContractRenewalDecisionDto,
  ContractRenewalRequestDto,
  ContractReportQuery,
  ContractTerminationDto,
  ContractTypeDto,
  CreateContractDto,
  RunContractRemindersDto,
  UpdateContractDto,
} from "./dto.js";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { Require } from "../common/decorators/require-permission.decorator.js";

@Controller("contracts")
export class ContractsController {
  constructor(private readonly service: ContractsService) {}

  // ───────────────────────────── Dashboard & Lookups ─────────────────────────────
  @Get("dashboard")
  @Require("contracts", "L")
  getDashboard(@CurrentUser() user: RequestUser) {
    return this.service.getDashboard(user);
  }

  @Get("lookups")
  @Require("contracts", "L")
  getLookups() {
    return this.service.getMasterLookups();
  }

  // ───────────────────────────── Master Contract Types ─────────────────────────────
  @Get("types")
  @Require("contracts", "L")
  listTypes() {
    return this.service.listTypes();
  }

  @Post("types")
  @Require("contracts", "C")
  createType(@Body() dto: ContractTypeDto) {
    return this.service.createType(dto);
  }

  @Patch("types/:id")
  @Require("contracts", "U")
  updateType(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ContractTypeDto,
  ) {
    return this.service.updateType(id, dto);
  }

  @Put("types/:id")
  @Require("contracts", "U")
  replaceType(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ContractTypeDto,
  ) {
    return this.service.updateType(id, dto);
  }

  @Delete("types/:id")
  @Require("contracts", "A")
  deleteType(@Param("id", ParseIntPipe) id: number) {
    return this.service.deleteType(id);
  }

  @Get("expiration-rules")
  @Require("contracts", "L")
  listExpirationRules() {
    return this.service.listExpirationRules();
  }

  // ───────────────────────────── Reminders & Reports ─────────────────────────────
  @Post("reminders/run")
  @Require("contracts", "U")
  runReminders(
    @Body() dto: RunContractRemindersDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.runReminders(dto, user);
  }

  @Get("reports/:type")
  @Require("contracts", "L")
  report(
    @Param("type") type: string,
    @Query() query: ContractReportQuery,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.report(type, query, user);
  }

  // ───────────────────────────── Contract Registry CRUD ─────────────────────────────
  @Get()
  @Require("contracts", "L")
  list(@Query() query: ContractQuery, @CurrentUser() user: RequestUser) {
    return this.service.list(query, user);
  }

  @Get(":id")
  @Require("contracts", "L")
  get(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.get(id, user);
  }

  @Post()
  @Require("contracts", "C")
  create(
    @Body() dto: CreateContractDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.create(dto, user);
  }

  @Patch(":id")
  @Require("contracts", "U")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateContractDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Put(":id")
  @Require("contracts", "U")
  replace(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateContractDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(":id")
  @Require("contracts", "A")
  remove(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.remove(id, user);
  }

  // ───────────────────────────── Approval Workflow ─────────────────────────────
  @Post(":id/approvals")
  @Require("contracts", "U")
  decideApproval(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ContractApprovalDecisionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.decideApproval(id, dto, user);
  }

  // ───────────────────────────── Documents & Versions ─────────────────────────────
  @Post(":id/documents")
  @Require("contracts", "C")
  addDocument(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ContractDocumentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.addDocument(id, dto, user);
  }

  @Post(":id/documents/:documentId/versions")
  @Require("contracts", "U")
  addDocumentVersion(
    @Param("id", ParseIntPipe) id: number,
    @Param("documentId", ParseIntPipe) documentId: number,
    @Body() dto: ContractDocumentVersionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.addDocumentVersion(id, documentId, dto, user);
  }

  @Delete(":id/documents/:documentId")
  @Require("contracts", "A")
  removeDocument(
    @Param("id", ParseIntPipe) id: number,
    @Param("documentId", ParseIntPipe) documentId: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.removeDocument(id, documentId, user);
  }

  // ───────────────────────────── Renewals ─────────────────────────────
  @Post(":id/renewals")
  @Require("contracts", "U")
  requestRenewal(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ContractRenewalRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.requestRenewal(id, dto, user);
  }

  @Post(":id/renewals/:renewalId/decision")
  @Require("contracts", "U")
  decideRenewal(
    @Param("id", ParseIntPipe) id: number,
    @Param("renewalId", ParseIntPipe) renewalId: number,
    @Body() dto: ContractRenewalDecisionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.decideRenewal(id, renewalId, dto, user);
  }

  // ───────────────────────────── Amendments (Addendum) ─────────────────────────────
  @Post(":id/amendments")
  @Require("contracts", "U")
  addAmendment(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ContractAmendmentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.addAmendment(id, dto, user);
  }

  // ───────────────────────────── Termination ─────────────────────────────
  @Post(":id/terminate")
  @Require("contracts", "U")
  terminate(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ContractTerminationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.terminate(id, dto, user);
  }

  // ───────────────────────────── Payment Schedules ─────────────────────────────
  @Post(":id/payment-schedules")
  @Require("contracts", "C")
  addPaymentSchedule(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ContractPaymentScheduleInputDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.addPaymentSchedule(id, dto, user);
  }

  @Patch(":id/payment-schedules/:scheduleId")
  @Require("contracts", "U")
  updatePaymentSchedule(
    @Param("id", ParseIntPipe) id: number,
    @Param("scheduleId", ParseIntPipe) scheduleId: number,
    @Body() dto: Partial<ContractPaymentScheduleInputDto>,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updatePaymentSchedule(id, scheduleId, dto, user);
  }

  // ───────────────────────────── ERP Relations ─────────────────────────────
  @Post(":id/relations")
  @Require("contracts", "C")
  addRelation(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ContractRelationInputDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.addRelation(id, dto, user);
  }

  @Delete(":id/relations/:relationId")
  @Require("contracts", "U")
  removeRelation(
    @Param("id", ParseIntPipe) id: number,
    @Param("relationId", ParseIntPipe) relationId: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.removeRelation(id, relationId, user);
  }
}
