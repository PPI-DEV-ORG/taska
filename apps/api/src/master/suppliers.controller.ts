import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { SuppliersService } from "./suppliers.service.js";
import { ListQuery, SupplierDto } from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";

@Controller("suppliers")
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

  @Get()
  @Require("suppliers", "L")
  list(@Query() q: ListQuery) {
    return this.service.list(q);
  }

  @Get("options")
  @Require("suppliers", "L")
  options() {
    return this.service.options();
  }

  @Get(":id")
  @Require("suppliers", "L")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Post()
  @Require("suppliers", "C")
  create(@Body() dto: SupplierDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @Require("suppliers", "U")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: SupplierDto) {
    return this.service.update(id, dto);
  }
}
