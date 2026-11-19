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
import { SubscriptionsService } from "./subscriptions.service.js";
import {
  CancellationDecisionDto,
  CancellationRequestDto,
  ChangeSubscriptionPlanDto,
  ConfirmBillingDraftDto,
  CreateSubscriptionDto,
  PostPrepaidDto,
  PrepaidGenerateDto,
  RejectRenewalDto,
  RenewSubscriptionDto,
  RunRemindersDto,
  SubscriptionCategoryDto,
  SubscriptionDocumentDto,
  SubscriptionPaymentDto,
  SubscriptionProviderDto,
  SubscriptionQuery,
  SubscriptionReportQuery,
  UpdateSubscriptionDto,
  UsageReviewDto,
} from "./dto.js";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { Require } from "../common/decorators/require-permission.decorator.js";

@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

  // ───────────────────────────── Dashboard ─────────────────────────────
  @Get("dashboard")
  @Require("subscriptions", "L")
  getDashboard() {
    return this.service.getDashboard();
  }

  // ───────────────────────────── Master kategori & provider ─────────────────────────────
  @Get("categories")
  @Require("subscriptions", "L")
  listCategories() {
    return this.service.listCategories();
  }

  @Post("categories")
  @Require("subscriptions", "C")
  createCategory(@Body() dto: SubscriptionCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Patch("categories/:id")
  @Require("subscriptions", "U")
  updateCategory(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SubscriptionCategoryDto,
  ) {
    return this.service.updateCategory(id, dto);
  }

  @Put("categories/:id")
  @Require("subscriptions", "U")
  replaceCategory(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SubscriptionCategoryDto,
  ) {
    return this.service.updateCategory(id, dto);
  }

  @Delete("categories/:id")
  @Require("subscriptions", "A")
  deleteCategory(@Param("id", ParseIntPipe) id: number) {
    return this.service.deleteCategory(id);
  }

  @Get("providers")
  @Require("subscriptions", "L")
  listProviders() {
    return this.service.listProviders();
  }

  @Post("providers")
  @Require("subscriptions", "C")
  createProvider(@Body() dto: SubscriptionProviderDto) {
    return this.service.createProvider(dto);
  }

  @Patch("providers/:id")
  @Require("subscriptions", "U")
  updateProvider(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SubscriptionProviderDto,
  ) {
    return this.service.updateProvider(id, dto);
  }

  @Put("providers/:id")
  @Require("subscriptions", "U")
  replaceProvider(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SubscriptionProviderDto,
  ) {
    return this.service.updateProvider(id, dto);
  }

  @Delete("providers/:id")
  @Require("subscriptions", "A")
  deleteProvider(@Param("id", ParseIntPipe) id: number) {
    return this.service.deleteProvider(id);
  }

  // ───────────────────────────── Recurring expense draft ─────────────────────────────
  @Get("billing-drafts")
  @Require("subscriptions", "L")
  listBillingDrafts(@Query() query: SubscriptionQuery) {
    return this.service.listBillingDrafts(query);
  }

  @Post("billing-drafts/:draftId/confirm")
  @Require("subscriptions", "U")
  confirmBillingDraft(
    @Param("draftId", ParseIntPipe) draftId: number,
    @Body() dto: ConfirmBillingDraftDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.confirmBillingDraft(draftId, dto, user);
  }

  // ───────────────────────────── Prepaid & reminder ─────────────────────────────
  @Post("prepaid/post-monthly")
  @Require("subscriptions", "U")
  postPrepaid(@Body() dto: PostPrepaidDto, @CurrentUser() user: RequestUser) {
    return this.service.postPrepaid(dto, user);
  }

  @Post("reminders/run")
  @Require("subscriptions", "U")
  runReminders(@Body() dto: RunRemindersDto, @CurrentUser() user: RequestUser) {
    return this.service.runReminders(dto, user);
  }

  // ───────────────────────────── Laporan ─────────────────────────────
  @Get("reports/:type")
  @Require("subscriptions", "L")
  report(
    @Param("type") type: string,
    @Query() query: SubscriptionReportQuery,
  ) {
    return this.service.report(type, query);
  }

  // ───────────────────────────── Registry ─────────────────────────────
  @Get()
  @Require("subscriptions", "L")
  list(@Query() query: SubscriptionQuery) {
    return this.service.list(query);
  }

  @Get(":id")
  @Require("subscriptions", "L")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Post()
  @Require("subscriptions", "C")
  create(@Body() dto: CreateSubscriptionDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Patch(":id")
  @Require("subscriptions", "U")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateSubscriptionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Put(":id")
  @Require("subscriptions", "U")
  replace(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateSubscriptionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(":id")
  @Require("subscriptions", "A")
  remove(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user);
  }

  // ───────────────────────────── Renewal & perubahan paket ─────────────────────────────
  @Post(":id/renew")
  @Require("subscriptions", "U")
  renew(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RenewSubscriptionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.renew(id, dto, user);
  }

  @Post(":id/reject-renewal")
  @Require("subscriptions", "U")
  rejectRenewal(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RejectRenewalDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.rejectRenewal(id, dto, user);
  }

  @Post(":id/change-plan")
  @Require("subscriptions", "U")
  changePlan(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ChangeSubscriptionPlanDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.changePlan(id, dto, user);
  }

  // ───────────────────────────── Pembayaran ─────────────────────────────
  @Post(":id/payments")
  @Require("subscriptions", "C")
  recordPayment(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SubscriptionPaymentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.recordPayment(id, dto, user);
  }

  // ───────────────────────────── Prepaid schedule ─────────────────────────────
  @Post(":id/prepaid/generate")
  @Require("subscriptions", "U")
  generatePrepaid(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: PrepaidGenerateDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.generatePrepaidSchedule(id, dto, user);
  }

  // ───────────────────────────── Recurring draft per langganan ─────────────────────────────
  @Post(":id/billing-drafts/generate")
  @Require("subscriptions", "U")
  generateBillingDraft(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.generateBillingDraft(id, user);
  }

  // ───────────────────────────── Pembatalan ─────────────────────────────
  @Post(":id/cancellation")
  @Require("subscriptions", "C")
  requestCancellation(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CancellationRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.requestCancellation(id, dto, user);
  }

  @Post(":id/cancellation/:cancellationId/decision")
  @Require("subscriptions", "V")
  decideCancellation(
    @Param("id", ParseIntPipe) id: number,
    @Param("cancellationId", ParseIntPipe) cancellationId: number,
    @Body() dto: CancellationDecisionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.decideCancellation(id, cancellationId, dto, user);
  }

  // ───────────────────────────── Utilisasi & dokumen ─────────────────────────────
  @Post(":id/usage")
  @Require("subscriptions", "U")
  reviewUsage(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UsageReviewDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.reviewUsage(id, dto, user);
  }

  @Post(":id/documents")
  @Require("subscriptions", "C")
  addDocument(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SubscriptionDocumentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.addDocument(id, dto, user);
  }

  @Delete(":id/documents/:documentId")
  @Require("subscriptions", "A")
  removeDocument(
    @Param("id", ParseIntPipe) id: number,
    @Param("documentId", ParseIntPipe) documentId: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.removeDocument(id, documentId, user);
  }
}
