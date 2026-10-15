import { type MeasuredRateLimiter, type SlidingWindowOptions } from '#/rate-limiter';
import { slidingWindowLog } from '#/throttle-log';

export {
  MAX_THROTTLE_KEYS,
  type MeasuredRateLimiter,
  type RateLimiter,
  type SlidingWindowOptions,
  type ThrottleDecision,
} from '#/rate-limiter';
export { slidingWindowLog } from '#/throttle-log';

/** The limiter a budget gets: the exact log, until a later increment says otherwise. */
export function slidingWindow(options: SlidingWindowOptions): MeasuredRateLimiter {
  return slidingWindowLog(options);
}
