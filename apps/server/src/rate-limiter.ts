/**
 * The ceiling on keys remembered at once. A limiter keyed on a value the
 * caller chooses is a memory-exhaustion vector of its own, so the map is
 * bounded outright rather than trusted to drain: past this, the
 * least-recently-seen key is dropped. The cost of a drop is that the key
 * gets a fresh budget, which is why the coldest goes first — an attacker
 * rotating keys evicts its own history, not the history of whoever is
 * being throttled. ADR 0023 records what this does and does not hold.
 */
export const MAX_THROTTLE_KEYS = 10_000;

export interface SlidingWindowOptions {
  /** Requests a key may make inside one window. */
  readonly limit: number;
  readonly windowSeconds: number;
  readonly now: () => Date;
  readonly maxKeys?: number;
}

export interface ThrottleDecision {
  readonly allowed: boolean;
  /** Zero when allowed; otherwise at least one and at most one window. */
  readonly retryAfterSeconds: number;
}

export interface RateLimiter {
  check: (key: string) => ThrottleDecision;
  /** How many keys are remembered right now — the bound under test. */
  size: () => number;
}

/** What a test counts to bound memory without measuring a heap. */
export interface MeasuredRateLimiter extends RateLimiter {
  /** Numbers held across all keys: timestamps for the log, counters for the counter. */
  retained: () => number;
}
