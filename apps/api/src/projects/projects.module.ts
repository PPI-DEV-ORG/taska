import { Module } from "@nestjs/common";
import { ProjectsService } from "./projects.service.js";
import { TasksService } from "./tasks.service.js";
import { ProjectsController } from "./projects.controller.js";
import { ProjectTasksController, TasksController } from "./tasks.controller.js";
import { StockModule } from "../stock/stock.module.js";

@Module({
  imports: [StockModule],
  providers: [ProjectsService, TasksService],
  controllers: [ProjectsController, ProjectTasksController, TasksController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
