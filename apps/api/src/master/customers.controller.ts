import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { CustomersService } from "./customers.service.js";
import { CustomerDto, ListQuery } from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";

@Controller("customers")
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Get()
  @Require("customers", "L")
  list(@Query() q: ListQuery) {
    return this.service.list(q);
  }

  @Get("options")
  @Require("customers", "L")
  options() {
    return this.service.options();
  }

  @Get(":id")
  @Require("customers", "L")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Post()
  @Require("customers", "C")
  create(@Body() dto: CustomerDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @Require("customers", "U")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: CustomerDto) {
    return this.service.update(id, dto);
  }
}
