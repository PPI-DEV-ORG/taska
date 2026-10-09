import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ProductsService } from "./products.service.js";
import { ListQuery, ProductDto } from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

@Controller("products")
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Get()
  @Require("products", "L")
  list(@Query() q: ListQuery, @CurrentUser() user: RequestUser) {
    return this.service.list(q, user);
  }

  @Get("options")
  @Require("products", "L")
  options(@CurrentUser() user: RequestUser) {
    return this.service.options(user);
  }

  @Get(":id")
  @Require("products", "L")
  get(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.get(id, user);
  }

  @Post()
  @Require("products", "C")
  create(@Body() dto: ProductDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @Require("products", "U")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: ProductDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user);
  }
}
