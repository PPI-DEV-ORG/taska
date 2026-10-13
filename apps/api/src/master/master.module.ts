import { Module } from "@nestjs/common";
import { CustomersService } from "./customers.service.js";
import { CustomersController } from "./customers.controller.js";
import { SuppliersService } from "./suppliers.service.js";
import { SuppliersController } from "./suppliers.controller.js";
import { ProductsService } from "./products.service.js";
import { ProductsController } from "./products.controller.js";
import { CategoriesService, WarehousesService } from "./categories-warehouses.service.js";
import { ProductCategoriesController, WarehousesController } from "./categories-warehouses.controller.js";
import { LookupsService } from "./lookups.service.js";
import {
  CostCentersController,
  ExpenseCategoriesController,
  LeadSourcesController,
  LostReasonsController,
} from "./lookups.controller.js";

@Module({
  providers: [CustomersService, SuppliersService, ProductsService, CategoriesService, WarehousesService, LookupsService],
  controllers: [
    CustomersController,
    SuppliersController,
    ProductsController,
    ProductCategoriesController,
    WarehousesController,
    LeadSourcesController,
    LostReasonsController,
    ExpenseCategoriesController,
    CostCentersController,
  ],
  exports: [ProductsService, SuppliersService, CustomersService, LookupsService],
})
export class MasterModule {}
