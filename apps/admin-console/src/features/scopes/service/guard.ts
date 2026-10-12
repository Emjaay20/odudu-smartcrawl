import { writeRefusal } from '#/shared/service/capabilities';
import { writeFailureText } from '#/shared/service/failure';
import type { GatewayFailure } from '#/shared/service/result';

const GUARDED = 'openid';

// The server refuses to delete it and says why; the console never offers the
// delete, so the refusal is never the first the caller hears of it.
export function isGuarded(name: string): boolean {
  return name === GUARDED;
}

export const GUARDED_TEXT =
  'openid cannot be deleted. Deleting it takes it off every client, the built-in admin client included, and could lock out every administrator of this tenant.';

export function scopeDeleteConsequence(name: string): string {
  return `Deleting ${name} takes it off every client assigned ${name} and unmaps every role mapped to it. It cannot be undone.`;
}

export function scopeDeleteFailureText(name: string, failure: GatewayFailure): string {
  return writeFailureText(failure, {
    name,
    verb: 'deleted',
    lookAt: 'the scopes list',
    missing: `${name} was already gone.`,
    refused: (problem) => writeRefusal(problem),
  });
}
