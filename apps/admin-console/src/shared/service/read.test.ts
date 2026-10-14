import { describe, expect, it } from 'vitest';
import { loadedData, mapRead, readOutcome } from '#/shared/service/read';
import type { GatewayResult } from '#/shared/service/result';

const retry = (): void => undefined;

const answered = (data: number): GatewayResult<number> => ({
  ok: true,
  status: 200,
  data,
  etag: null,
  next: null,
});

const problem = (status: number): GatewayResult<number> => ({
  ok: false,
  kind: 'problem',
  problem: { type: 'about:blank', title: 'Problem', status },
});

describe('readOutcome', () => {
  it('is loading until it answers', () => {
    expect(readOutcome(undefined, retry)).toEqual({ status: 'loading' });
  });

  it('is ready with the data', () => {
    expect(readOutcome(answered(7), retry)).toEqual({ status: 'ready', data: 7 });
  });

  it('is failed, refused only for a 403, with the way to ask again', () => {
    expect(readOutcome(problem(403), retry)).toEqual({ status: 'failed', refused: true, retry });
    expect(readOutcome(problem(500), retry)).toMatchObject({ refused: false });
    expect(readOutcome({ ok: false, kind: 'network' }, retry)).toMatchObject({
      status: 'failed',
      refused: false,
    });
  });
});

describe('mapRead', () => {
  it('maps what is ready and passes loading and failure through', () => {
    expect(mapRead(readOutcome(answered(2), retry), (n) => n * 2)).toEqual({
      status: 'ready',
      data: 4,
    });
    const failed = readOutcome<number>(problem(500), retry);
    expect(mapRead(failed, (n) => n * 2)).toBe(failed);
    const loading = readOutcome<number>(undefined, retry);
    expect(mapRead(loading, (n) => n * 2)).toBe(loading);
  });
});

describe('loadedData', () => {
  it('is the data of a read that came, and nothing of one that did not', () => {
    expect(loadedData({ status: 'ready', data: 3 })).toBe(3);
    expect(loadedData({ status: 'loading' })).toBeUndefined();
    const failed = { status: 'failed' as const, retry };
    expect(loadedData(failed)).toBeUndefined();
  });
});
