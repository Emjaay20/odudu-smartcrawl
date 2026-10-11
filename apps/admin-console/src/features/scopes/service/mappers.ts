import type { GatewayFailure } from '#/shared/service/result.ts';
import { andList } from '#/shared/service/format.ts';

export const FALLBACK_TEXT =
  "No mapper is bound, so this scope falls back to the scope's declared mappers.";

export function mapperOptions(
  available: readonly string[],
): readonly { id: string; label: string }[] {
  return available.map((name) => ({ id: name, label: name }));
}

export function mappersSummary(bound: readonly string[]): string {
  return bound.length === 0 ? FALLBACK_TEXT : `Bound: ${andList(bound)}.`;
}

const UNKNOWN = /^unknown mapper name\(s\): (.+); known: (.+)$/u;

// Null for a failure with nothing to add to the shared wording.
export function mappersFailureText(failure: GatewayFailure): string | null {
  if (failure.kind !== 'problem' || failure.problem.status !== 400) return null;
  const found = UNKNOWN.exec(failure.problem.detail ?? '');
  if (found === null) return null;
  const [, unknown = '', known = ''] = found;
  return `Not saved: no mapper named ${unknown}. The mappers are ${andList(known.split(', '))}.`;
}

// The failure with an unknown mapper's refusal worded to name the registry,
// and any other failure as it came.
export function mappersFailure<F extends GatewayFailure>(failure: F): F {
  const text = mappersFailureText(failure);
  if (text === null || failure.kind !== 'problem') return failure;
  return {
    ...failure,
    problem: { ...failure.problem, errors: [{ path: 'mapper_names', message: text }] },
  };
}
