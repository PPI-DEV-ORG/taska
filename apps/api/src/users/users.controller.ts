import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";
import { UsersService } from "./users.service.js";
import { CreateUserDto, UpdateUserDto } from "./dto/user.dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { PageQuery } from "../common/dto/page-query.js";

class UserQuery extends PageQuery {
  @IsOptional() @IsString()
  role?: string;

  @IsOptional() @IsString()
  status?: string;
}

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Require("users", "L")
  list(@Query() q: UserQuery) {
    return this.users.list(q);
  }

  /** Pilihan anggota tim survey/proyek (hanya data minim). */
  @Get("options")
  options(@Query("role") role?: string) {
    return this.users.options(role);
  }

  @Get(":id")
  @Require("users", "L")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.users.get(id);
  }

  @Post()
  @Require("users", "C")
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(":id")
  @Require("users", "U")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }
}
