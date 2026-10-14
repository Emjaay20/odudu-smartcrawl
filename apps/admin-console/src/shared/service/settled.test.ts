import { expect, it } from 'vitest';
import type { GatewayFailure, GatewayResult } from '#/shared/service/result';
import { failureOf, failureOfSettled, restOf, type Settled } from '#/shared/service/settled';

const refused: GatewayFailure = { ok: false, kind: 'network' };
const kept: Settled<string> = { ok: true, rest: 'kept' };
const failed: Settled<string> = { ok: false, failure: refused };

it('keeps the rest of a write that succeeded, and nothing before or after a failure', () => {
  expect(restOf(kept)).toBe('kept');
  expect(restOf(failed)).toBeNull();
  expect(restOf(undefined)).toBeNull();
});

it('keeps the failure of a write that failed, and nothing before or after a success', () => {
  expect(failureOfSettled(failed)).toBe(refused);
  expect(failureOfSettled(kept)).toBeNull();
  expect(failureOfSettled(undefined)).toBeNull();
});

it('keeps the refusal in an answer, and nothing while there is no answer', () => {
  const answered: GatewayResult<string> = {
    ok: true,
    status: 200,
    data: 'x',
    etag: null,
    next: null,
  };
  expect(failureOf(refused)).toBe(refused);
  expect(failureOf(answered)).toBeNull();
  expect(failureOf(undefined)).toBeNull();
});
