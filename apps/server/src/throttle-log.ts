import {
  MAX_THROTTLE_KEYS,
  type MeasuredRateLimiter,
  type SlidingWindowOptions,
} from '#/rate-limiter';

/**
 * The exact sliding window: one timestamp per admitted request per key. A
 * refused request is not recorded, so retrying does not extend the wait the
 * way an attempt during an account lockout does — this is a budget rather
 * than a punishment. Memory is `limit` timestamps per key at worst.
 */
export function slidingWindowLog(options: SlidingWindowOptions): MeasuredRateLimiter {
  const windowMs = options.windowSeconds * 1000;
  const maxKeys = options.maxKeys ?? MAX_THROTTLE_KEYS;
  // Insertion order is recency order: every touched key is deleted and
  // re-set, which moves it to the end.
  const seen = new Map<string, number[]>();

  // One entry per call, which is enough to keep the map to the keys seen
  // inside the window: a key is only ever added by a call.
  const dropColdestIfStale = (cutoff: number): void => {
    const coldest = seen.entries().next();
    if (coldest.done === true) return;
    const [key, hits] = coldest.value;
    if ((hits.at(-1) ?? 0) <= cutoff) seen.delete(key);
  };

  return {
    check: (key) => {
      const now = options.now().getTime();
      const cutoff = now - windowMs;
      dropColdestIfStale(cutoff);

      const hits = (seen.get(key) ?? []).filter((at) => at > cutoff);
      seen.delete(key);
      const refused = hits.length >= options.limit;
      if (!refused) hits.push(now);
      seen.set(key, hits);
      while (seen.size > maxKeys) {
        const coldest = seen.keys().next();
        if (coldest.done === true) break;
        seen.delete(coldest.value);
      }

      if (!refused) return { allowed: true, retryAfterSeconds: 0 };
      const oldest = hits[0] ?? now;
      const waitMs = oldest + windowMs - now;
      // Capped at the window: a clock that stepped back leaves hits stamped
      // in what is now the future, and waiting longer than a window for them
      // would be a refusal nothing the caller did can explain.
      const seconds = Math.min(options.windowSeconds, Math.ceil(waitMs / 1000));
      return { allowed: false, retryAfterSeconds: Math.max(1, seconds) };
    },
    size: () => seen.size,
    retained: () => {
      let held = 0;
      for (const hits of seen.values()) held += hits.length;
      return held;
    },
  };
}
