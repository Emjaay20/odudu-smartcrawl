import { andList } from '#/shared/service/format';
import type { GatewayFailure } from '#/shared/service/result';

const UNKNOWN = /^unknown authenticator "([^"]+)"; expected one of (.+)$/u;
const REPEATED = /^authenticator "([^"]+)" appears more than once/u;

// The flow replacement's 400s carry their reason only in `detail`.
export function flowRefusalText(detail: string): string {
  if (detail.startsWith('a flow needs at least one step')) {
    return 'The flow has no step. Add one: nobody could sign in to a tenant with no flow.';
  }
  if (detail.startsWith('every step is disabled')) {
    return 'Every step is disabled, so nobody could sign in. Enable at least one step.';
  }
  if (detail.startsWith('no step would run at the start')) {
    return 'Nothing in this order can start a sign-in. When it begins nobody is identified yet, so only the password step can run: the first step that cannot be skipped has to be password, or an alternative next to it, and it has to be enabled.';
  }
  const unknown = UNKNOWN.exec(detail);
  if (unknown?.[1] !== undefined && unknown[2] !== undefined) {
    return `“${unknown[1]}” is not an authenticator this server has. It has ${andList(unknown[2].split(', '))}.`;
  }
  const repeated = REPEATED.exec(detail);
  if (repeated?.[1] !== undefined) {
    return `“${repeated[1]}” is a step twice. An authenticator is one step.`;
  }
  return detail;
}

// A 400 said under the steps in the console's words; any other failure as it came.
export function flowFailure<F extends GatewayFailure>(failure: F): F {
  if (failure.kind !== 'problem' || failure.problem.status !== 400) return failure;
  const detail = failure.problem.detail ?? failure.problem.title;
  return {
    ...failure,
    problem: {
      ...failure.problem,
      errors: [{ path: 'steps', message: flowRefusalText(detail) }],
    },
  };
}
