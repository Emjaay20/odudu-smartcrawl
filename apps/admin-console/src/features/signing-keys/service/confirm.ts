import type { SigningKey } from '@odudu/contracts/admin';
import type { KeyAction } from '#/features/signing-keys/service/outcome';
import { promoteWarning, type Promotion } from '#/features/signing-keys/service/promotion';

export function promoteConsequence(
  key: SigningKey,
  active: SigningKey | undefined,
  promotion: Promotion,
): string {
  const replaced =
    active === undefined
      ? ''
      : ` The ${active.alg} key ${active.kid} it replaces stays published, as rotating, until you retire it.`;
  const warning = promoteWarning(promotion);
  return `From now on this ${key.alg} key signs every new token.${replaced}${warning === null ? '' : ` ${warning}`}`;
}

// The kid names exactly one key, which an algorithm or a date does not.
export function retireTyped(key: SigningKey): string {
  return key.kid;
}

export function retireConsequence(key: SigningKey): string {
  return `The ${key.alg} key ${key.kid} is no longer published, so a token it signed stops verifying at once. Retire it only when no token it signed can still be in use. The token this console holds for you may be one of them: a read is then refused once, and the console carries on with a new token.`;
}

export function deleteConsequence(key: SigningKey): string {
  return `The record of the ${key.alg} key ${key.kid} is removed for good. It is published nowhere and signs nothing, so no token depends on it. This cannot be undone.`;
}

export interface KeyDialog {
  title: string;
  consequence: string;
  confirmLabel: string;
  tone: 'primary' | 'danger';
  typed?: string;
}

export function dialogOf(
  action: KeyAction,
  key: SigningKey,
  active: SigningKey | undefined,
  promotion: Promotion,
): KeyDialog {
  switch (action) {
    case 'promote':
      return {
        title: 'Promote this key?',
        consequence: promoteConsequence(key, active, promotion),
        confirmLabel: 'Promote key',
        tone: 'primary',
      };
    case 'retire':
      return {
        title: 'Retire this key?',
        consequence: retireConsequence(key),
        confirmLabel: 'Retire key',
        tone: 'danger',
        typed: retireTyped(key),
      };
    case 'delete':
      return {
        title: 'Delete this key?',
        consequence: deleteConsequence(key),
        confirmLabel: 'Delete key',
        tone: 'danger',
      };
  }
}
