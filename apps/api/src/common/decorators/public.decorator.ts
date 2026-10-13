import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Lewati autentikasi JWT untuk endpoint ini (mis. /auth/login). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
