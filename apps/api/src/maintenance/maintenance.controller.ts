import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { MaintenanceService } from "./maintenance.service.js";
import {
  MaintenanceActionItemDto,
  MaintenanceListQuery,
  MaintenanceReportDto,
  MaintenanceStatusDto,
  CreateMaintCategoryDto,
  UpdateMaintCategoryDto,
  CreateMaintChecklistDto,
  UpdateMaintChecklistDto,
  CreateMaintVendorDto,
  UpdateMaintVendorDto,
  CreateMaintPlanDto,
  UpdateMaintPlanDto,
  GenerateSchedulesDto,
  RescheduleScheduleDto,
  CreateMaintRequestDto,
  UpdateMaintRequestDto,
  InitialInspectRequestDto,
  CreateMaintWorkOrderDto,
  UpdateMaintWorkOrderDto,
  AssignWorkOrderDto,
  UpdateWorkOrderStatusDto,
  AddWorkOrderTaskDto,
  UpdateWorkOrderTaskDto,
  UpdateWorkOrderChecklistDto,
  AddWorkOrderMaterialDto,
  AddWorkOrderLaborDto,
  AddWorkOrderCostDto,
  RecordWorkOrderDowntimeDto,
  AddWorkOrderAttachmentDto,
  VerifyWorkOrderDto,
  CloseWorkOrderDto,
  EvaluateCapitalizationDto,
  MaintQueryDto,
  MaintReportQueryDto,
} from "./dto.js";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { Require } from "../common/decorators/require-permission.decorator.js";

@Controller(["maintenance", "maintenance-reports"])
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  // ────────────────────────────── Dashboard & Reports ──────────────────────────────

  @Get("dashboard")
  @Require("maintenanceReports", "L")
  getDashboard() {
    return this.service.getDashboard();
  }

  @Get("reports")
  @Require("maintenanceReports", "L")
  getReports(@Query() query: MaintReportQueryDto) {
    return this.service.getReports(query);
  }

  @Get("lookups")
  @Require("maintenanceReports", "L")
  getLookups() {
    return this.service.getLookups();
  }

  // ────────────────────────────── Master Data: Categories ──────────────────────────────

  @Get("categories")
  @Require("maintenanceReports", "L")
  listCategories() {
    return this.service.listCategories();
  }

  @Post("categories")
  @Require("maintenanceReports", "C")
  createCategory(@Body() dto: CreateMaintCategoryDto, @CurrentUser() user: RequestUser) {
    return this.service.createCategory(dto, user);
  }

  @Patch("categories/:id")
  @Require("maintenanceReports", "U")
  updateCategory(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMaintCategoryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateCategory(id, dto, user);
  }

  @Delete("categories/:id")
  @Require("maintenanceReports", "D")
  deleteCategory(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.deleteCategory(id, user);
  }

  // ────────────────────────────── Master Data: Checklists ──────────────────────────────

  @Get("checklists")
  @Require("maintenanceReports", "L")
  listChecklists(@Query("categoryId") categoryId?: string) {
    return this.service.listChecklists(categoryId ? parseInt(categoryId, 10) : undefined);
  }

  @Get("checklists/:id")
  @Require("maintenanceReports", "L")
  getChecklist(@Param("id", ParseIntPipe) id: number) {
    return this.service.getChecklist(id);
  }

  @Post("checklists")
  @Require("maintenanceReports", "C")
  createChecklist(@Body() dto: CreateMaintChecklistDto, @CurrentUser() user: RequestUser) {
    return this.service.createChecklist(dto, user);
  }

  @Patch("checklists/:id")
  @Require("maintenanceReports", "U")
  updateChecklist(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMaintChecklistDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateChecklist(id, dto, user);
  }

  @Delete("checklists/:id")
  @Require("maintenanceReports", "D")
  deleteChecklist(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.deleteChecklist(id, user);
  }

  // ────────────────────────────── Master Data: Vendors ──────────────────────────────

  @Get("vendors")
  @Require("maintenanceReports", "L")
  listVendors() {
    return this.service.listVendors();
  }

  @Post("vendors")
  @Require("maintenanceReports", "C")
  createVendor(@Body() dto: CreateMaintVendorDto, @CurrentUser() user: RequestUser) {
    return this.service.createVendor(dto, user);
  }

  @Patch("vendors/:id")
  @Require("maintenanceReports", "U")
  updateVendor(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMaintVendorDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateVendor(id, dto, user);
  }

  @Delete("vendors/:id")
  @Require("maintenanceReports", "D")
  deleteVendor(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.deleteVendor(id, user);
  }

  // ────────────────────────────── Preventive: Plans ──────────────────────────────

  @Get("plans")
  @Require("maintenanceReports", "L")
  listPlans(@Query() q: MaintQueryDto) {
    return this.service.listPlans(q);
  }

  @Get("plans/:id")
  @Require("maintenanceReports", "L")
  getPlan(@Param("id", ParseIntPipe) id: number) {
    return this.service.getPlan(id);
  }

  @Post("plans")
  @Require("maintenanceReports", "C")
  createPlan(@Body() dto: CreateMaintPlanDto, @CurrentUser() user: RequestUser) {
    return this.service.createPlan(dto, user);
  }

  @Patch("plans/:id")
  @Require("maintenanceReports", "U")
  updatePlan(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMaintPlanDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updatePlan(id, dto, user);
  }

  @Delete("plans/:id")
  @Require("maintenanceReports", "D")
  deletePlan(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.deletePlan(id, user);
  }

  @Post("plans/:id/generate-schedules")
  @Require("maintenanceReports", "U")
  generateSchedules(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: GenerateSchedulesDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.generateSchedulesForPlan(id, dto, user);
  }

  // ────────────────────────────── Service Schedules ──────────────────────────────

  @Get("schedules")
  @Require("maintenanceReports", "L")
  listSchedules(@Query() q: MaintQueryDto) {
    return this.service.listSchedules(q);
  }

  @Post("schedules/:id/reschedule")
  @Require("maintenanceReports", "U")
  reschedule(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RescheduleScheduleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.reschedule(id, dto, user);
  }

  @Delete("schedules/:id")
  @Require("maintenanceReports", "D")
  deleteSchedule(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.deleteSchedule(id, user);
  }

  // ────────────────────────────── Corrective: Requests ──────────────────────────────

  @Get("requests")
  @Require("maintenanceReports", "L")
  listRequests(@Query() q: MaintQueryDto, @CurrentUser() user: RequestUser) {
    return this.service.listRequests(q, user);
  }

  @Get("requests/:id")
  @Require("maintenanceReports", "L")
  getRequest(@Param("id", ParseIntPipe) id: number) {
    return this.service.getRequest(id);
  }

  @Post("requests")
  @Require("maintenanceReports", "C")
  createRequest(@Body() dto: CreateMaintRequestDto, @CurrentUser() user: RequestUser) {
    return this.service.createRequest(dto, user);
  }

  @Patch("requests/:id")
  @Require("maintenanceReports", "U")
  updateRequest(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMaintRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateRequest(id, dto, user);
  }

  @Delete("requests/:id")
  @Require("maintenanceReports", "D")
  deleteRequest(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.deleteRequest(id, user);
  }

  @Post("requests/:id/inspect")
  @Require("maintenanceReports", "U")
  initialInspectRequest(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: InitialInspectRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.initialInspectRequest(id, dto, user);
  }

  @Post("requests/:id/create-work-order")
  @Require("maintenanceReports", "C")
  convertRequestToWorkOrder(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.convertRequestToWorkOrder(id, user);
  }

  // ────────────────────────────── Work Orders (Core EAM) ──────────────────────────────

  @Get("work-orders")
  @Require("maintenanceReports", "L")
  listWorkOrders(@Query() q: MaintQueryDto) {
    return this.service.listWorkOrders(q);
  }

  @Get("work-orders/:id")
  @Require("maintenanceReports", "L")
  getWorkOrder(@Param("id", ParseIntPipe) id: number) {
    return this.service.getWorkOrder(id);
  }

  @Post("work-orders")
  @Require("maintenanceReports", "C")
  createWorkOrder(@Body() dto: CreateMaintWorkOrderDto, @CurrentUser() user: RequestUser) {
    return this.service.createWorkOrder(dto, user);
  }

  @Patch("work-orders/:id")
  @Require("maintenanceReports", "U")
  updateWorkOrder(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMaintWorkOrderDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateWorkOrder(id, dto, user);
  }

  @Delete("work-orders/:id")
  @Require("maintenanceReports", "D")
  deleteWorkOrder(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.deleteWorkOrder(id, user);
  }

  @Post("work-orders/:id/assign")
  @Require("maintenanceReports", "U")
  assignWorkOrder(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AssignWorkOrderDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.assignWorkOrder(id, dto, user);
  }

  @Post("work-orders/:id/status")
  @Patch("work-orders/:id/status")
  @Require("maintenanceReports", "U")
  updateWorkOrderStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateWorkOrderStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateWorkOrderStatus(id, dto, user);
  }

  @Post("work-orders/:id/verify")
  @Require("maintenanceReports", "U")
  verifyWorkOrder(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: VerifyWorkOrderDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.verifyWorkOrder(id, dto, user);
  }

  @Post("work-orders/:id/close")
  @Require("maintenanceReports", "U")
  closeWorkOrder(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CloseWorkOrderDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.closeWorkOrder(id, dto, user);
  }

  // Work Order Tasks
  @Post("work-orders/:id/tasks")
  @Require("maintenanceReports", "U")
  addTask(@Param("id", ParseIntPipe) id: number, @Body() dto: AddWorkOrderTaskDto) {
    return this.service.addTask(id, dto);
  }

  @Patch("work-orders/:id/tasks/:taskId")
  @Require("maintenanceReports", "U")
  updateTask(
    @Param("taskId", ParseIntPipe) taskId: number,
    @Body() dto: UpdateWorkOrderTaskDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateTask(taskId, dto, user);
  }

  @Delete("work-orders/:id/tasks/:taskId")
  @Require("maintenanceReports", "U")
  deleteTask(@Param("taskId", ParseIntPipe) taskId: number) {
    return this.service.deleteTask(taskId);
  }

  // Work Order Checklists
  @Patch("work-orders/:id/checklists/:checklistId")
  @Require("maintenanceReports", "U")
  updateWorkOrderChecklist(
    @Param("checklistId", ParseIntPipe) checklistId: number,
    @Body() dto: UpdateWorkOrderChecklistDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateWorkOrderChecklist(checklistId, dto, user);
  }

  // Work Order Materials
  @Post("work-orders/:id/materials")
  @Require("maintenanceReports", "U")
  addMaterial(@Param("id", ParseIntPipe) id: number, @Body() dto: AddWorkOrderMaterialDto) {
    return this.service.addMaterial(id, dto);
  }

  @Delete("work-orders/:id/materials/:materialId")
  @Require("maintenanceReports", "U")
  deleteMaterial(@Param("materialId", ParseIntPipe) materialId: number) {
    return this.service.deleteMaterial(materialId);
  }

  // Work Order Labor
  @Post("work-orders/:id/labor")
  @Require("maintenanceReports", "U")
  addLabor(@Param("id", ParseIntPipe) id: number, @Body() dto: AddWorkOrderLaborDto) {
    return this.service.addLabor(id, dto);
  }

  @Delete("work-orders/:id/labor/:laborId")
  @Require("maintenanceReports", "U")
  deleteLabor(@Param("laborId", ParseIntPipe) laborId: number) {
    return this.service.deleteLabor(laborId);
  }

  // Work Order Costs
  @Post("work-orders/:id/costs")
  @Require("maintenanceReports", "U")
  addCost(@Param("id", ParseIntPipe) id: number, @Body() dto: AddWorkOrderCostDto) {
    return this.service.addCost(id, dto);
  }

  @Delete("work-orders/:id/costs/:costId")
  @Require("maintenanceReports", "U")
  deleteCost(@Param("costId", ParseIntPipe) costId: number) {
    return this.service.deleteCost(costId);
  }

  // Work Order Downtime
  @Post("work-orders/:id/downtime")
  @Require("maintenanceReports", "U")
  recordDowntime(@Param("id", ParseIntPipe) id: number, @Body() dto: RecordWorkOrderDowntimeDto) {
    return this.service.recordDowntime(id, dto);
  }

  // Work Order Attachments
  @Post("work-orders/:id/attachments")
  @Require("maintenanceReports", "U")
  addAttachment(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AddWorkOrderAttachmentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.addAttachment(id, dto, user);
  }

  @Delete("work-orders/:id/attachments/:attachmentId")
  @Require("maintenanceReports", "U")
  deleteAttachment(@Param("attachmentId", ParseIntPipe) attachmentId: number) {
    return this.service.deleteAttachment(attachmentId);
  }

  // Work Order Capitalization
  @Post("work-orders/:id/capitalize")
  @Require("maintenanceReports", "U")
  evaluateCapitalization(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: EvaluateCapitalizationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.evaluateCapitalization(id, dto, user);
  }

  // ────────────────────────────── Asset History & Downtime ──────────────────────────────

  @Get("assets/:assetId/history")
  @Require("maintenanceReports", "L")
  listAssetHistory(@Param("assetId", ParseIntPipe) assetId: number) {
    return this.service.listAssetHistory(assetId);
  }

  @Get("assets/:assetId/downtimes")
  @Require("maintenanceReports", "L")
  listAssetDowntimes(@Param("assetId", ParseIntPipe) assetId: number) {
    return this.service.listAssetDowntimes(assetId);
  }

  // ────────────────────────────── Legacy Maintenance Reports (Preserved) ──────────────────────────────

  @Get("field-reports")
  @Require("maintenanceReports", "L")
  listFieldReports(@Query() q: MaintenanceListQuery, @CurrentUser() user: RequestUser) {
    return this.service.list(q, user);
  }

  @Get()
  @Require("maintenanceReports", "L")
  list(@Query() q: MaintenanceListQuery, @CurrentUser() user: RequestUser) {
    return this.service.list(q, user);
  }

  @Get(":id")
  @Require("maintenanceReports", "L")
  get(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.detail(id, user);
  }

  @Post()
  @Require("maintenanceReports", "C")
  create(@Body() dto: MaintenanceReportDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Patch(":id")
  @Require("maintenanceReports", "U")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: MaintenanceReportDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Post(":id/status")
  @Patch(":id/status")
  @Require("maintenanceReports", "U")
  updateStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: MaintenanceStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateStatus(id, dto, user);
  }

  @Delete(":id")
  @Require("maintenanceReports", "U")
  remove(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.delete(id, user);
  }

  @Post(":id/actions")
  @Require("maintenanceReports", "U")
  addAction(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: MaintenanceActionItemDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.addActionItem(id, dto, user);
  }

  @Patch(":id/actions/:actionId")
  @Require("maintenanceReports", "U")
  updateAction(
    @Param("id", ParseIntPipe) _id: number,
    @Param("actionId", ParseIntPipe) actionId: number,
    @Body() dto: Partial<MaintenanceActionItemDto>,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateActionItem(actionId, dto, user);
  }

  @Delete(":id/actions/:actionId")
  @Require("maintenanceReports", "U")
  deleteAction(
    @Param("id", ParseIntPipe) _id: number,
    @Param("actionId", ParseIntPipe) actionId: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.deleteActionItem(actionId, user);
  }

  @Get(":id/expenses-summary")
  @Require("maintenanceReports", "L")
  calculateExpenseSummary(@Param("id", ParseIntPipe) id: number) {
    return this.service.calculateExpenseSummary(id);
  }
}
