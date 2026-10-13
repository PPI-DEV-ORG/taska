import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export type RequestUser = {
  id: number;
  email: string;
  name: string;
  role: string;
};

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestUser => {
  return ctx.switchToHttp().getRequest().user;
});
