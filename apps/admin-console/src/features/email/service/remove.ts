import { writeRefusal } from '#/shared/service/capabilities';
import { writeFailureText } from '#/shared/service/failure';
import type { GatewayResult } from '#/shared/service/result';

export const REMOVED_TEXT = 'The tenant’s own relay was removed.';

export const ALREADY_NONE = 'The tenant already had none. The page is read again.';

export interface RemoveOutcome {
  done: boolean;
  text: string;
}

export function removeConsequence(): string {
  return 'The relay and its stored password are deleted. Mail then goes through the deployment’s sender if it has one, and is only logged if not. Setting a relay again means entering its password again.';
}

export function removeOutcome(result: GatewayResult<unknown>): RemoveOutcome {
  if (result.ok) return { done: true, text: REMOVED_TEXT };
  if (result.kind === 'problem' && result.problem.status === 404) {
    return { done: true, text: ALREADY_NONE };
  }
  return {
    done: false,
    text: writeFailureText(result, {
      name: 'The relay',
      verb: 'removed',
      lookAt: 'the page',
      refused: (problem) => writeRefusal(problem, 'manage-tenant'),
    }),
  };
}
