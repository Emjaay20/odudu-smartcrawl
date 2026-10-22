import { withTenant, type DatabaseHandle } from '@odudu/db';
import { actionTokenRepository } from '#/repository/action-tokens';
import { type ActionTokenRecord, type ActionTokenType } from '#/schema/action-tokens';
import { orderedActions, type LinkedRequiredAction } from '#/service/required-actions';

export type { LinkedRequiredAction };

export interface PeekActionTokenDeps {
  readonly database: DatabaseHandle;
  readonly tenantId: string;
}

export type PeekActionTokenResult =
  | {
      kind: 'usable';
      type: ActionTokenType;
      /** An actions link's actions, in the order they are asked; empty for any other link. */
      actions: readonly LinkedRequiredAction[];
      /** Whether an actions link asks for a new password. */
      setsPassword: boolean;
      /** The sign-in the link came out of, when one did. */
      authenticationSessionId: string | null;
    }
  // `type` says what an unusable link was for when the row is still held, so
  // the refusal can offer the step that fits it.
  | { kind: 'invalid'; type?: ActionTokenType; authenticationSessionId?: string | null };

// The read the action-token route needs before it can decide which page to
// show: a reset-password link needs a form rendered before anything is
// consumed, unlike a verify-email link, which the route still consumes on
// the same GET. Never reached from a view directly against the repository —
// this usecase is the seam layering requires.
export async function peekActionToken(
  deps: PeekActionTokenDeps,
  key: string,
): Promise<PeekActionTokenResult> {
  return withTenant(deps.database.db, deps.tenantId, async (tx) => {
    const tokens = actionTokenRepository(tx);
    const peeked = await tokens.peek(key);
    if (peeked !== null) return usable(peeked);
    const described = await tokens.describe(key);
    return described === null ? { kind: 'invalid' } : { kind: 'invalid', ...described };
  });
}

function usable(peeked: ActionTokenRecord): PeekActionTokenResult {
  const actions = orderedActions(peeked.actions ?? []);
  return {
    kind: 'usable',
    type: peeked.type,
    actions,
    setsPassword: actions.includes('update-password'),
    authenticationSessionId: peeked.authenticationSessionId,
  };
}
