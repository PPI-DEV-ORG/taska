import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  limit = 20;

  @IsOptional() @IsString()
  q?: string;

  @IsOptional() @IsString()
  sort?: string;

  @IsOptional() @IsIn(["asc", "desc"])
  dir: "asc" | "desc" = "desc";
}

export type PageResult<T> = { items: T[]; total: number; page: number; limit: number };

export function paginate<T>(items: T[], total: number, q: PageQuery): PageResult<T> {
  return { items, total, page: q.page, limit: q.limit };
}
