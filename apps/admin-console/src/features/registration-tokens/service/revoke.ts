import { writeRefusal } from '#/shared/service/capabilities';
import { removalOutcome, type RemovalOutcome } from '#/shared/service/failure';
import { counted } from '#/shared/service/format';
import type { GatewayResult } from '#/shared/service/result';

export const REVOKED_TEXT = 'The token was revoked.';

// The server answers a token that was used up or has expired as it answers a revoked one.
export const ALREADY_GONE =
  'That token is already gone: it was used up, expired or revoked. The list is read again.';

export function revokeConsequence(token: { remaining_uses: number }): string {
  return `Nobody can register a client with it again, and its ${counted(token.remaining_uses, 'use', 'uses')} left are lost. Clients it already registered are not affected.`;
}

export function revokeOutcome(result: GatewayResult<unknown>): RemovalOutcome {
  return removalOutcome(
    result,
    { doneText: REVOKED_TEXT, alreadyGoneText: ALREADY_GONE },
    {
      name: 'The token',
      verb: 'revoked',
      lookAt: 'the list',
      refused: (problem) => writeRefusal(problem, 'manage-clients'),
    },
  );
}
