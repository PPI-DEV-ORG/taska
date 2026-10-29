import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { IsOptional, IsString, MinLength } from "class-validator";
import { LookupsService, type LookupModel } from "./lookups.service.js";
import { ListQuery } from "./dto.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import type { ModuleKey } from "../rbac/permissions.js";

class NameDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  status?: string;
}

function makeLookupController(path: string, model: LookupModel, moduleKey: ModuleKey) {
  @Controller(path)
  class LookupController {
    constructor(readonly service: LookupsService) {}

    @Get()
    @Require(moduleKey, "L")
    list(@Query() q: ListQuery) {
      return this.service.list(model, q);
    }

    @Get("options")
    @Require(moduleKey, "L")
    options() {
      return this.service.options(model);
    }

    @Post()
    @Require(moduleKey, "C")
    create(@Body() dto: NameDto) {
      return this.service.create(model, dto.name || `Item-${Date.now()}`, dto.status);
    }

    @Patch(":id")
    @Require(moduleKey, "U")
    update(@Param("id", ParseIntPipe) id: number, @Body() dto: NameDto) {
      return this.service.update(model, id, dto.name, dto.status);
    }

    @Delete(":id")
    @Require(moduleKey, "U")
    remove(@Param("id", ParseIntPipe) id: number) {
      return this.service.remove(model, id);
    }
  }
  return LookupController;
}

export const LeadSourcesController = makeLookupController("lead-sources", "leadSource", "leadSources");
export const LostReasonsController = makeLookupController("lost-reasons", "lostReason", "lostReasons");
export const ExpenseCategoriesController = makeLookupController(
  "expense-categories",
  "expenseCategory",
  "expenseCategories",
);
export const CostCentersController = makeLookupController("cost-centers", "costCenter", "costCenters");
export const VisitActivityTypesController = makeLookupController(
  "visit-activity-types",
  "visitActivityType",
  "visitReports",
);

class CoaAccountDto {
  @IsOptional() @IsString()
  code?: string;

  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @IsString()
  normalBalance?: string;

  @IsOptional() @IsString()
  type?: string;

  @IsOptional() @IsString()
  parentCode?: string;
}

@Controller("coa-accounts")
export class CoaAccountsController {
  constructor(readonly service: LookupsService) {}

  @Get()
  list() {
    return this.service.listCoa();
  }

  @Post()
  create(@Body() dto: CoaAccountDto) {
    return this.service.upsertCoa(dto);
  }

  @Delete(":code")
  remove(@Param("code") code: string) {
    return this.service.removeCoa(code);
  }
}
