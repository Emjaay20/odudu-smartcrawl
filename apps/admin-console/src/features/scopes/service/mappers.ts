import type { GatewayFailure } from '#/shared/service/result';
import { andList } from '#/shared/service/format';
import type { Choice } from '#/shared/service/choice';

export const NONE_TEXT =
  'No mapper is bound and none declares it, so a token granted this scope gets no claim from it.';

export function mapperOptions(available: readonly string[]): readonly Choice[] {
  return available.map((name) => ({ id: name, label: name }));
}

// While nothing is bound, issuance runs the mappers that declare the scope.
export function mappersSummary(bound: readonly string[], declared: readonly string[]): string {
  if (bound.length > 0) return `Bound: ${andList(bound)}.`;
  if (declared.length === 0) return NONE_TEXT;
  return `No mapper is bound, so this scope uses the mappers that declare it: ${andList(declared)}.`;
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

// A draft's mapper list as the unsaved-changes summary reads it.
export function describeMappers(value: unknown): string {
  return Array.isArray(value) && value.length > 0 ? andList(value.map(String)) : 'none';
}
