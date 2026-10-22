import { SetMetadata } from "@nestjs/common";

export const SKIP_THROTTLE_KEY = "skipThrottle";

/**
 * Decorator untuk mengecualikan endpoint dari rate-limiting / throttle.
 */
export const SkipThrottle = () => SetMetadata(SKIP_THROTTLE_KEY, true);

