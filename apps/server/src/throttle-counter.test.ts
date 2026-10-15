import { describe, expect, it } from 'vitest';
import { MAX_THROTTLE_KEYS } from '#/rate-limiter';
import {
  COUNTER_THRESHOLD,
  slidingWindow,
  slidingWindowCounter,
  slidingWindowLog,
} from '#/throttle';

const ORIGIN_MS = 1_700_000_040_000;

function at(seconds: number): Date {
  return new Date(ORIGIN_MS + seconds * 1000);
}

// A small deterministic generator, so a failing case can be replayed.
function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 2 ** 32;
  };
}

describe('slidingWindowCounter', () => {
  it('lets a key spend its budget and refuses the next request', () => {
    const limiter = slidingWindowCounter({ limit: 200, windowSeconds: 60, now: () => at(0) });

    for (let attempt = 0; attempt < 200; attempt += 1) {
      expect(limiter.check('198.51.100.7')).toEqual({ allowed: true, retryAfterSeconds: 0 });
    }
    const refused = limiter.check('198.51.100.7');

    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(refused.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('weights the previous window by how much of it still overlaps', () => {
    let seconds = 0;
    const limiter = slidingWindowCounter({ limit: 200, windowSeconds: 60, now: () => at(seconds) });
    for (let attempt = 0; attempt < 200; attempt += 1) limiter.check('k');

    // Halfway into the next window the previous 200 weigh 100, so 100 more fit.
    seconds = 60 + 30;
    let admitted = 0;
    while (limiter.check('k').allowed) admitted += 1;

    expect(admitted).toBe(100);
  });

  it('records nothing for a refused request', () => {
    let seconds = 0;
    const limiter = slidingWindowCounter({ limit: 200, windowSeconds: 60, now: () => at(seconds) });
    for (let attempt = 0; attempt < 200; attempt += 1) limiter.check('k');
    for (let attempt = 0; attempt < 500; attempt += 1) limiter.check('k');

    // The 500 refusals did not become next window's weight: only the 200 did.
    seconds = 60 + 30;
    let admitted = 0;
    while (limiter.check('k').allowed) admitted += 1;
    expect(admitted).toBe(100);
  });

  it('keeps two keys independent', () => {
    const limiter = slidingWindowCounter({ limit: 200, windowSeconds: 60, now: () => at(0) });
    for (let attempt = 0; attempt < 200; attempt += 1) limiter.check('198.51.100.7');

    expect(limiter.check('198.51.100.7').allowed).toBe(false);
    expect(limiter.check('203.0.113.9').allowed).toBe(true);
  });

  it('forgets a key two windows after its last request', () => {
    let seconds = 0;
    const limiter = slidingWindowCounter({ limit: 200, windowSeconds: 60, now: () => at(seconds) });
    for (let key = 0; key < 100; key += 1) limiter.check(`198.51.100.${String(key)}`);
    const warm = limiter.size();

    seconds = 3600;
    for (let attempt = 0; attempt < 100; attempt += 1) limiter.check('203.0.113.9');

    expect(warm).toBe(100);
    expect(limiter.size()).toBeLessThanOrEqual(2);
  });

  it('evicts the coldest key, not the one being hit', () => {
    const limiter = slidingWindowCounter({
      limit: 200,
      windowSeconds: 60,
      now: () => at(0),
      maxKeys: 2,
    });
    for (let attempt = 0; attempt < 200; attempt += 1) limiter.check('198.51.100.7');
    for (let key = 0; key < 20; key += 1) {
      limiter.check(`203.0.113.${String(key)}`);
      limiter.check('198.51.100.7');
    }

    expect(limiter.size()).toBeLessThanOrEqual(2);
    expect(limiter.check('198.51.100.7').allowed).toBe(false);
  });

  it('forgets what the previous window held once a whole window passes with nothing', () => {
    let seconds = 0;
    const limiter = slidingWindowCounter({ limit: 200, windowSeconds: 60, now: () => at(seconds) });
    // Behind it in the map, so the stale-key sweep takes this one and 'k'
    // is still there to be rolled forward rather than recreated.
    limiter.check('older');
    for (let attempt = 0; attempt < 200; attempt += 1) limiter.check('k');

    // Window 0 spent, window 1 idle, window 2 reached: window 0 is no longer
    // the previous window, so nothing of it weighs on the estimate.
    seconds = 125;
    expect(limiter.check('k')).toEqual({ allowed: true, retryAfterSeconds: 0 });
    let admitted = 1;
    while (limiter.check('k').allowed) admitted += 1;
    expect(admitted).toBe(200);
  });

  it('gives a key a fresh budget when the clock steps back past two windows', () => {
    let seconds = 300;
    const limiter = slidingWindowCounter({ limit: 200, windowSeconds: 60, now: () => at(seconds) });
    for (let attempt = 0; attempt < 200; attempt += 1) limiter.check('k');
    expect(limiter.check('k').allowed).toBe(false);

    // Accepted rather than clamped: holding the last instant seen would
    // freeze every window for as long as a forward jump lasted.
    seconds = 60;
    expect(limiter.check('k').allowed).toBe(true);
  });

  describe('Retry-After', () => {
    // Wherever in the window the refusal lands, and however the previous
    // window was spent: at least a second, at most one window, and waiting
    // it out is enough unless it was capped to the window.
    it('is never zero, never longer than a window, and sufficient when uncapped', () => {
      const random = lcg(7);
      for (let trial = 0; trial < 300; trial += 1) {
        const limit = 101 + Math.floor(random() * 400);
        const windowSeconds = 10 + Math.floor(random() * 110);
        let ms = 0;
        const limiter = slidingWindowCounter({
          limit,
          windowSeconds,
          now: () => new Date(ORIGIN_MS + ms),
        });
        const key = 'k';
        const spend = (count: number, fromMs: number, spanMs: number): void => {
          for (let n = 0; n < count; n += 1) {
            ms = fromMs + Math.floor((spanMs * n) / Math.max(1, count));
            limiter.check(key);
          }
        };
        spend(Math.floor(random() * limit), 0, windowSeconds * 1000);
        spend(limit, windowSeconds * 1000, Math.floor(random() * windowSeconds * 1000) + 1);
        ms = windowSeconds * 1000 + Math.floor(random() * windowSeconds * 1000);

        const decision = limiter.check(key);
        if (decision.allowed) continue;

        expect(decision.retryAfterSeconds).toBeGreaterThanOrEqual(1);
        expect(decision.retryAfterSeconds).toBeLessThanOrEqual(windowSeconds);
        if (decision.retryAfterSeconds < windowSeconds) {
          ms += decision.retryAfterSeconds * 1000;
          expect(limiter.check(key).allowed).toBe(true);
        }
      }
    });
  });

  // Stated error (ADR 0023): the counter assumes the previous window's
  // requests were spread evenly. For a steady stream — evenly spaced, from
  // the first request — its estimate is within two requests of the exact
  // count, so it admits every request of a stream at least two under the
  // budget and refuses a stream at least two over it, as the exact log does.
  describe('against the exact log, on a steady stream', () => {
    const ERROR = 2;
    const WINDOWS = 6;

    function refusals(
      build: typeof slidingWindowLog,
      limit: number,
      windowSeconds: number,
      perWindow: number,
    ): { refused: number; admitted: number } {
      let ms = 0;
      const limiter = build({ limit, windowSeconds, now: () => new Date(ORIGIN_MS + ms) });
      const gapMs = (windowSeconds * 1000) / perWindow;
      let refused = 0;
      let admitted = 0;
      for (let n = 0; ms < WINDOWS * windowSeconds * 1000; n += 1) {
        ms = Math.floor(n * gapMs);
        if (limiter.check('k').allowed) admitted += 1;
        else refused += 1;
      }
      return { refused, admitted };
    }

    it('admits a stream the log admits and refuses one the log refuses, but for the stated error', () => {
      const random = lcg(42);
      for (let trial = 0; trial < 50; trial += 1) {
        const limit = 101 + Math.floor(random() * 300);
        const windowSeconds = 10 + Math.floor(random() * 110);
        const perWindow = limit + (random() * 2 - 1) * 12;

        const exact = refusals(slidingWindowLog, limit, windowSeconds, perWindow);
        const counter = refusals(slidingWindowCounter, limit, windowSeconds, perWindow);

        if (perWindow <= limit - ERROR) {
          expect(exact.refused).toBe(0);
          expect(counter.refused).toBe(0);
        }
        if (perWindow >= limit + ERROR) {
          expect(exact.refused).toBeGreaterThan(0);
          expect(counter.refused).toBeGreaterThan(0);
        }
      }
    });

    it('admits as many as the log over a long overload, within one budget', () => {
      for (const limit of [101, 250, 400]) {
        const exact = refusals(slidingWindowLog, limit, 60, limit * 3);
        const counter = refusals(slidingWindowCounter, limit, 60, limit * 3);

        expect(Math.abs(counter.admitted - exact.admitted)).toBeLessThanOrEqual(limit);
        expect(counter.admitted).toBeLessThanOrEqual(limit * WINDOWS);
      }
    });
  });

  // The counter holds three numbers per key whatever the limit, which is
  // what makes a high limit affordable. Counted structurally: a heap delta
  // moves with the garbage collector and the runtime, and the thing being
  // bounded is how many values are retained, not how many bytes the engine
  // spends on each.
  it('retains three numbers per key at a limit of 1000 across the whole key cap', () => {
    const limiter = slidingWindowCounter({ limit: 1000, windowSeconds: 60, now: () => at(0) });

    // Spending a budget of 1000 on every one of 20,000 keys is twenty
    // million calls; the count does not depend on how many each key made.
    for (let key = 0; key < MAX_THROTTLE_KEYS * 2; key += 1) {
      const spent = key % 1000 === 0 ? 1000 : 1;
      for (let attempt = 0; attempt < spent; attempt += 1) limiter.check(`k${String(key)}`);
    }

    expect(limiter.size()).toBe(MAX_THROTTLE_KEYS);
    expect(limiter.retained()).toBe(3 * MAX_THROTTLE_KEYS);
  });
});

describe('slidingWindow picks the implementation by budget', () => {
  it('puts the line at a limit of one hundred', () => {
    expect(COUNTER_THRESHOLD).toBe(100);
  });

  const spend = (limit: number): number => {
    const limiter = slidingWindow({ limit, windowSeconds: 60, now: () => at(0) });
    for (let key = 0; key < 50; key += 1) {
      for (let attempt = 0; attempt < limit; attempt += 1) limiter.check(`k${String(key)}`);
    }
    return limiter.retained();
  };

  it('keeps the exact log up to the threshold', () => {
    expect(spend(COUNTER_THRESHOLD)).toBe(50 * COUNTER_THRESHOLD);
  });

  it('switches to the counter above it', () => {
    expect(spend(COUNTER_THRESHOLD + 1)).toBe(50 * 3);
  });
});

describe('the exact log at the default budget', () => {
  it('holds ten timestamps per key across the whole key cap', () => {
    const log = slidingWindowLog({ limit: 10, windowSeconds: 60, now: () => at(0) });

    for (let key = 0; key < MAX_THROTTLE_KEYS * 2; key += 1) {
      for (let attempt = 0; attempt < 10; attempt += 1) log.check(`k${String(key)}`);
    }

    expect(log.size()).toBe(MAX_THROTTLE_KEYS);
    expect(log.retained()).toBe(10 * MAX_THROTTLE_KEYS);
  });
});
