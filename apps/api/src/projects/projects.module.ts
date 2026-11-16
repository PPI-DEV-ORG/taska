import { Module } from "@nestjs/common";
import { ProjectsService } from "./projects.service.js";
import { ProjectCostService } from "./project-cost.js";
import { TasksService } from "./tasks.service.js";
import { ProjectsController } from "./projects.controller.js";
import { ProjectTasksController, TasksController } from "./tasks.controller.js";
import { StockModule } from "../stock/stock.module.js";
import { UploadModule } from "../upload/upload.module.js";

@Module({
  imports: [StockModule, UploadModule],
  providers: [ProjectsService, TasksService, ProjectCostService],
  controllers: [ProjectsController, ProjectTasksController, TasksController],
  exports: [ProjectsService, ProjectCostService],
})
export class ProjectsModule {}
