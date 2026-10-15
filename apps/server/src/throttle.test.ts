import { describe, expect, it } from 'vitest';
import { MAX_THROTTLE_KEYS, slidingWindow, slidingWindowLog } from '#/throttle';

function at(seconds: number): Date {
  return new Date(1_700_000_000_000 + seconds * 1000);
}

describe('slidingWindow', () => {
  it('lets every request under the limit through', () => {
    const window = slidingWindow({ limit: 10, windowSeconds: 60, now: () => at(0) });

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      expect(window.check('198.51.100.7')).toEqual({ allowed: true, retryAfterSeconds: 0 });
    }
  });

  it('refuses the one over the limit, and says how long to wait', () => {
    const window = slidingWindow({ limit: 10, windowSeconds: 60, now: () => at(0) });
    for (let attempt = 1; attempt <= 10; attempt += 1) window.check('198.51.100.7');

    const refused = window.check('198.51.100.7');

    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
    expect(refused.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('lets one through again once the oldest request falls out of the window', () => {
    let seconds = 0;
    const window = slidingWindow({ limit: 3, windowSeconds: 60, now: () => at(seconds) });

    window.check('198.51.100.7');
    seconds = 30;
    window.check('198.51.100.7');
    window.check('198.51.100.7');
    expect(window.check('198.51.100.7').allowed).toBe(false);

    // The first request is now 61 seconds old; the two at 30 seconds are not.
    seconds = 61;
    expect(window.check('198.51.100.7')).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(window.check('198.51.100.7').allowed).toBe(false);
  });

  it('counts a refused request against nothing, so the wait does not grow by retrying', () => {
    let seconds = 0;
    const window = slidingWindow({ limit: 2, windowSeconds: 60, now: () => at(seconds) });
    window.check('198.51.100.7');
    window.check('198.51.100.7');

    seconds = 30;
    const first = window.check('198.51.100.7');
    seconds = 40;
    const second = window.check('198.51.100.7');

    expect(first.allowed).toBe(false);
    expect(second.allowed).toBe(false);
    expect(second.retryAfterSeconds).toBeLessThan(first.retryAfterSeconds);
  });

  it('keeps two keys independent', () => {
    const window = slidingWindow({ limit: 2, windowSeconds: 60, now: () => at(0) });

    window.check('198.51.100.7');
    window.check('198.51.100.7');

    expect(window.check('198.51.100.7').allowed).toBe(false);
    expect(window.check('203.0.113.9').allowed).toBe(true);
  });

  // A limiter keyed on attacker-controlled input is a memory-exhaustion
  // vector of its own unless the eviction is real, so the bound is asserted
  // rather than described.
  it('holds a hard ceiling on the number of keys it remembers', () => {
    const window = slidingWindow({ limit: 10, windowSeconds: 60, now: () => at(0) });

    for (let key = 0; key < MAX_THROTTLE_KEYS * 3; key += 1) {
      window.check(`198.51.100.${String(key)}`);
    }

    expect(window.size()).toBeLessThanOrEqual(MAX_THROTTLE_KEYS);
  });

  // Eviction by insertion order would throw away the attacker being
  // throttled, since that key was inserted first, and hand back a fresh
  // budget every time the ceiling is reached.
  it('evicts the coldest key, not the one being hit', () => {
    const window = slidingWindow({ limit: 3, windowSeconds: 60, now: () => at(0), maxKeys: 2 });

    window.check('198.51.100.7');
    for (let key = 0; key < 20; key += 1) {
      window.check(`203.0.113.${String(key)}`);
      window.check('198.51.100.7');
    }

    expect(window.size()).toBeLessThanOrEqual(2);
    expect(window.check('198.51.100.7').allowed).toBe(false);
  });

  it('forgets a key whose requests have all aged out, without waiting for the ceiling', () => {
    let seconds = 0;
    const window = slidingWindow({ limit: 10, windowSeconds: 60, now: () => at(seconds) });

    for (let key = 0; key < 100; key += 1) {
      window.check(`198.51.100.${String(key)}`);
      seconds += 1;
    }
    const whileWarm = window.size();

    seconds += 3600;
    for (let key = 0; key < 100; key += 1) window.check('203.0.113.9');

    expect(whileWarm).toBeGreaterThan(50);
    expect(window.size()).toBeLessThanOrEqual(2);
  });
});

describe('slidingWindowLog', () => {
  it('is what slidingWindow builds for the default budget', () => {
    const options = { limit: 10, windowSeconds: 60, now: () => at(0) };
    const built = slidingWindow(options);
    const log = slidingWindowLog(options);

    for (let attempt = 0; attempt < 12; attempt += 1) {
      expect(built.check('198.51.100.7')).toEqual(log.check('198.51.100.7'));
    }
    expect(built.size()).toBe(log.size());
  });

  it('retains one timestamp per admitted request, and none for a refused one', () => {
    const log = slidingWindowLog({ limit: 3, windowSeconds: 60, now: () => at(0) });
    for (let attempt = 0; attempt < 8; attempt += 1) log.check('198.51.100.7');
    log.check('203.0.113.9');

    expect(log.retained()).toBe(4);
  });
});

describe('a clock that steps backwards', () => {
  it('never tells the log’s caller to wait longer than one window', () => {
    let seconds = 0;
    const log = slidingWindowLog({ limit: 2, windowSeconds: 60, now: () => at(seconds) });
    seconds = 200;
    log.check('k');
    log.check('k');

    seconds = 80;
    const refused = log.check('k');

    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBeLessThanOrEqual(60);
    expect(refused.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});

describe('the log at the edges of its window', () => {
  it('counts a request exactly one window old as already out of it', () => {
    let seconds = 0;
    const log = slidingWindowLog({ limit: 1, windowSeconds: 60, now: () => at(seconds) });
    log.check('k');

    seconds = 59.999;
    expect(log.check('k').allowed).toBe(false);
    seconds = 60;
    expect(log.check('k').allowed).toBe(true);
  });
});
