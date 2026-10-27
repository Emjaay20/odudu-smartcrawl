import { describe, expect, it } from 'vitest';
import { createFallbackReporter, MAX_REPORTED_FALLBACKS } from '#/template-fallback';

describe('createFallbackReporter', () => {
  it('logs a template that fell back once per scope and kind', () => {
    const logged: unknown[] = [];
    const reporter = createFallbackReporter((entry) => logged.push(entry));
    const report = reporter('tenant-1:v3');
    report('sign-in', 'unknown slot nonesuch');
    report('sign-in', 'unknown slot nonesuch');
    report('consent', 'unknown message x');
    reporter('tenant-1:v4')('sign-in', 'unknown slot nonesuch');
    expect(logged).toEqual([
      { scope: 'tenant-1:v3', kind: 'sign-in', reason: 'unknown slot nonesuch' },
      { scope: 'tenant-1:v3', kind: 'consent', reason: 'unknown message x' },
      { scope: 'tenant-1:v4', kind: 'sign-in', reason: 'unknown slot nonesuch' },
    ]);
  });

  it('remembers at most the bound, then starts again', () => {
    const logged: unknown[] = [];
    const reporter = createFallbackReporter((entry) => logged.push(entry), 3);
    for (const scope of ['a', 'b', 'c', 'd']) reporter(scope)('sign-in', 'r');
    expect(logged).toHaveLength(4);
    reporter('d')('sign-in', 'r');
    expect(logged).toHaveLength(4);
    reporter('a')('sign-in', 'r');
    expect(logged).toHaveLength(5);
  });

  it('keeps a hostile reason to one bounded line', () => {
    const logged: { reason: string }[] = [];
    const report = createFallbackReporter((entry) => logged.push(entry))('s');
    report('sign-in', `${'x'.repeat(500)}\nforged log line`);
    expect(logged[0]?.reason.length).toBeLessThanOrEqual(200);
    expect(logged[0]?.reason).not.toContain('\n');
  });

  it('states a bound of 1,024 entries', () => {
    expect(MAX_REPORTED_FALLBACKS).toBe(1024);
  });
});
