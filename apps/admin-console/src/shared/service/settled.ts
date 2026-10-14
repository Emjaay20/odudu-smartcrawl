import type { GatewayFailure, GatewayResult } from '#/shared/service/result';

// What a write that returns the part of its answer worth keeping settled with.
export type Settled<Rest> = { ok: true; rest: Rest } | { ok: false; failure: GatewayFailure };

export function restOf<Rest>(settled: Settled<Rest> | undefined): Rest | null {
  return settled?.ok === true ? settled.rest : null;
}

export function failureOfSettled<Rest>(settled: Settled<Rest> | undefined): GatewayFailure | null {
  return settled?.ok === false ? settled.failure : null;
}

// The refusal in a write's answer, nothing while it has not answered.
export function failureOf(result: GatewayResult<unknown> | undefined): GatewayFailure | null {
  return result === undefined || result.ok ? null : result;
}
