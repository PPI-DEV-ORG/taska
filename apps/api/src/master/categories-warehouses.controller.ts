import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { CategoriesService, WarehousesService } from "./categories-warehouses.service.js";
import { ListQuery, ProductCategoryDto, WarehouseDto } from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";

@Controller("product-categories")
export class ProductCategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Get()
  @Require("productCategories", "L")
  list(@Query() q: ListQuery) {
    return this.service.list(q);
  }

  @Post()
  @Require("productCategories", "C")
  create(@Body() dto: ProductCategoryDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @Require("productCategories", "U")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: ProductCategoryDto) {
    return this.service.update(id, dto);
  }
}

@Controller("warehouses")
export class WarehousesController {
  constructor(private readonly service: WarehousesService) {}

  @Get()
  @Require("warehouses", "L")
  list(@Query() q: ListQuery) {
    return this.service.list(q);
  }

  @Get("options")
  @Require("warehouses", "L")
  options() {
    return this.service.options();
  }

  @Get(":id")
  @Require("warehouses", "L")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Post()
  @Require("warehouses", "C")
  create(@Body() dto: WarehouseDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @Require("warehouses", "U")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: WarehouseDto) {
    return this.service.update(id, dto);
  }
}
