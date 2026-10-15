import {
  MAX_THROTTLE_KEYS,
  type MeasuredRateLimiter,
  type SlidingWindowOptions,
} from '#/rate-limiter';

interface Counts {
  /** Which fixed window `current` belongs to. */
  window: number;
  previous: number;
  current: number;
}

/**
 * The sliding-window counter: two counts per key, the current fixed window
 * and the one before, estimating the trailing window as
 * `previous * (1 - elapsed fraction) + current`. It assumes the previous
 * window's requests were spread evenly; ADR 0023 states what that costs.
 * Memory is three numbers per key whatever the limit, which is the reason
 * to prefer it where `limit` is large.
 */
export function slidingWindowCounter(options: SlidingWindowOptions): MeasuredRateLimiter {
  const windowMs = options.windowSeconds * 1000;
  const maxKeys = options.maxKeys ?? MAX_THROTTLE_KEYS;
  const seen = new Map<string, Counts>();

  // A key two windows old contributes nothing to any estimate.
  const dropColdestIfStale = (window: number): void => {
    const coldest = seen.entries().next();
    if (coldest.done === true) return;
    const [key, counts] = coldest.value;
    if (counts.window <= window - 2) seen.delete(key);
  };

  const roll = (counts: Counts, window: number): void => {
    if (counts.window === window) return;
    counts.previous = counts.window === window - 1 ? counts.current : 0;
    counts.current = 0;
    counts.window = window;
  };

  return {
    check: (key) => {
      const now = options.now().getTime();
      const window = Math.floor(now / windowMs);
      dropColdestIfStale(window);

      const counts = seen.get(key) ?? { window, previous: 0, current: 0 };
      seen.delete(key);
      roll(counts, window);
      seen.set(key, counts);
      while (seen.size > maxKeys) {
        const coldest = seen.keys().next();
        if (coldest.done === true) break;
        seen.delete(coldest.value);
      }

      const elapsed = (now - window * windowMs) / windowMs;
      const estimate = counts.previous * (1 - elapsed) + counts.current;
      if (estimate + 1 <= options.limit) {
        counts.current += 1;
        return { allowed: true, retryAfterSeconds: 0 };
      }

      // Within this window the previous count's weight falls linearly, so
      // solve for the instant the estimate admits one more. When this
      // window's own count is already the limit nothing helps until the
      // next window rolls; the answer is then capped at one window, since
      // the estimate is no better than that.
      const room = options.limit - 1 - counts.current;
      const waitMs =
        room >= 0 && counts.previous > 0
          ? (1 - room / counts.previous - elapsed) * windowMs
          : (1 - elapsed) * windowMs + windowMs / options.limit;
      const seconds = Math.min(options.windowSeconds, Math.ceil(waitMs / 1000));
      return { allowed: false, retryAfterSeconds: Math.max(1, seconds) };
    },
    size: () => seen.size,
    retained: () => seen.size * 3,
  };
}
