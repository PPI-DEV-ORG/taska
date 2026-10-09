import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { UsersModule } from "./users/users.module.js";
import { UploadModule } from "./upload/upload.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { ApprovalsModule } from "./approvals/approvals.module.js";
import { AuditModule } from "./audit/audit.module.js";
import { SettingsModule } from "./settings/settings.module.js";
import { DocumentNumberModule } from "./document-number/document-number.module.js";
import { MasterModule } from "./master/master.module.js";
import { CrmModule } from "./crm/crm.module.js";
import { FinanceModule } from "./finance/finance.module.js";
import { ProjectsModule } from "./projects/projects.module.js";
import { ProcurementModule } from "./procurement/procurement.module.js";
import { StockModule } from "./stock/stock.module.js";
import { DeliveryModule } from "./delivery/delivery.module.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { ReportsModule } from "./reports/reports.module.js";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard.js";
import { PermissionsGuard } from "./common/guards/permissions.guard.js";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor.js";
import { AuditInterceptor } from "./common/interceptors/audit.interceptor.js";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: false }),
    PrismaModule,
    AuditModule,
    SettingsModule,
    DocumentNumberModule,
    AuthModule,
    UsersModule,
    UploadModule,
    NotificationsModule,
    ApprovalsModule,
    MasterModule,
    CrmModule,
    FinanceModule,
    ProjectsModule,
    ProcurementModule,
    StockModule,
    DeliveryModule,
    DashboardModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
