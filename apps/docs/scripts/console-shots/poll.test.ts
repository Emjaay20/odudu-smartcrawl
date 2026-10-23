import { describe, expect, it } from 'vitest';
import { untilSettled } from './poll.ts';

const never = (): Promise<void> => Promise.resolve();

describe('untilSettled', () => {
  it('returns the first read that is accepted, however many were not', async () => {
    const reads = [[], [], ['odudu-admin'], ['odudu-admin', 'my-app']];
    let at = 0;
    const seen = await untilSettled(
      () => Promise.resolve(reads[Math.min(at++, reads.length - 1)] ?? []),
      (rows) => rows.length === 2,
      { timeoutMs: 1000, intervalMs: 1, wait: never },
    );
    expect(seen).toEqual(['odudu-admin', 'my-app']);
    expect(at).toBe(5);
  });

  it('fails with the last thing it saw when nothing is ever accepted', async () => {
    let at = 0;
    await expect(
      untilSettled(
        () => Promise.resolve([`read ${String(at++)}`]),
        () => false,
        { timeoutMs: 5, intervalMs: 1, wait: () => new Promise((done) => setTimeout(done, 2)) },
      ),
    ).rejects.toThrow(/read \d+/u);
  });

  it('does not accept a state that merely passes through the right one', async () => {
    const reads = [
      ['a', 'b'],
      ['a', 'b', 'c'],
    ];
    let at = 0;
    await expect(
      untilSettled(
        () => Promise.resolve(reads[Math.min(at++, 1)] ?? []),
        (rows) => rows.length === 2,
        {
          timeoutMs: 5,
          intervalMs: 1,
          settledReads: 3,
          wait: () => new Promise((done) => setTimeout(done, 2)),
        },
      ),
    ).rejects.toThrow(/a,b,c|a, b, c|\["a","b","c"\]/u);
  });
});
