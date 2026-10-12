import { SYSTEM_TENANT } from '#/shared/service/principal';

const SYSTEM_FIXED =
  'system cannot be disabled: it is the tenant every cross-tenant administrator signs in to.';

// Why a tenant cannot be enabled or disabled, shown as fixed text.
export function disableFixed(name: string): string | null {
  return name === SYSTEM_TENANT ? SYSTEM_FIXED : null;
}
