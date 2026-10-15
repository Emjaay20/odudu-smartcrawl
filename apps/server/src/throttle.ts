import { type MeasuredRateLimiter, type SlidingWindowOptions } from '#/rate-limiter';
import { slidingWindowCounter } from '#/throttle-counter';
import { slidingWindowLog } from '#/throttle-log';

export {
  MAX_THROTTLE_KEYS,
  type MeasuredRateLimiter,
  type RateLimiter,
  type SlidingWindowOptions,
  type ThrottleDecision,
} from '#/rate-limiter';
export { slidingWindowCounter } from '#/throttle-counter';
export { slidingWindowLog } from '#/throttle-log';

/**
 * Past this limit the exact log stops being affordable: at the key cap it
 * holds `limit` timestamps per key, about 9 MB at 100 and 100 MB at 1000
 * (ADR 0023). Above it the counter's constant memory is worth its
 * approximation, which at a budget this size is a rounding error.
 */
export const COUNTER_THRESHOLD = 100;

export function slidingWindow(options: SlidingWindowOptions): MeasuredRateLimiter {
  return options.limit > COUNTER_THRESHOLD
    ? slidingWindowCounter(options)
    : slidingWindowLog(options);
}
