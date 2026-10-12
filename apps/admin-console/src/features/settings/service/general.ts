import { SYSTEM_TENANT } from '#/shared/service/principal';

export function disablesTenant(was: boolean, now: boolean): boolean {
  return was && !now;
}

export function disableFixed(tenant: string): string | null {
  return tenant === SYSTEM_TENANT
    ? 'The system tenant cannot be disabled: it holds the administrators of every other tenant.'
    : null;
}

export function disableConsequence(tenant: string): string {
  return `Nobody can sign in to ${tenant} while it is disabled, including you: the console session ends and the tenant answers as one that does not exist. Only a system administrator can enable it again.`;
}
