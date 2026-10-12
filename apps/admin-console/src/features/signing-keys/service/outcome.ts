import type { SigningKey } from '@odudu/contracts/admin';
import { writeRefusal } from '#/shared/service/capabilities';
import { writeFailureText } from '#/shared/service/failure';
import { sentence } from '#/shared/service/format';
import type { GatewayResult, Problem } from '#/shared/service/result';

export type KeyAction = 'promote' | 'retire' | 'delete';

export interface KeyOutcome {
  // The key is where the action meant it to be, whoever put it there.
  done: boolean;
  text: string;
}

const VERB: Record<KeyAction, string> = {
  promote: 'promoted',
  retire: 'retired',
  delete: 'deleted',
};

const ACTIVE_TEXT =
  'The active key cannot be retired. Promote another key first, then retire this one.';
const NOT_RETIRED_TEXT = 'Only a retired key can be deleted. Retire it first.';
const GONE_TEXT = 'That key is already gone. The lanes are read again.';
const CANNOT_PROMOTE_TEXT =
  'The key can no longer be promoted: it was retired or deleted. The lanes are read again.';

function successText(action: KeyAction, key: SigningKey): string {
  const named = `The ${key.alg} key ${key.kid}`;
  switch (action) {
    case 'promote':
      return `${named} is now the active key.`;
    case 'retire':
      return `${named} was retired. It is no longer published.`;
    case 'delete':
      return `${named} was deleted.`;
  }
}

function refusalText(action: KeyAction, key: SigningKey, problem: Problem): string | null {
  switch (problem.type) {
    case 'about:blank#key-active':
      return ACTIVE_TEXT;
    case 'about:blank#key-not-retired':
      return NOT_RETIRED_TEXT;
    case 'about:blank#key-algorithm-needed':
      return `Refused: ${sentence(problem.detail ?? `a client still needs ${key.alg}`)} Stage another ${key.alg} key, or move those clients to another algorithm, then retire this one.`;
    default:
      return action === 'promote' && problem.status === 404
        ? CANNOT_PROMOTE_TEXT
        : writeRefusal(problem, 'manage-keys');
  }
}

export function keyActionOutcome(
  action: KeyAction,
  key: SigningKey,
  result: GatewayResult<unknown>,
): KeyOutcome {
  if (result.ok) return { done: true, text: successText(action, key) };
  if (result.kind === 'problem' && result.problem.status === 404 && action !== 'promote') {
    return { done: true, text: GONE_TEXT };
  }
  return {
    done: false,
    text: writeFailureText(result, {
      name: 'The key',
      verb: VERB[action],
      lookAt: 'the lanes',
      refused: (problem) => refusalText(action, key, problem),
    }),
  };
}
