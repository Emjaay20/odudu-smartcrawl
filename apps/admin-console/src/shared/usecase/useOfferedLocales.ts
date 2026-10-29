import { useTenantSettings } from '#/shared/repository/useTenantSettings';
import { offeredRead } from '#/shared/service/offeredLocales';
import type { Read } from '#/shared/service/read';

// The languages the tenant offers, for a field that holds text in each.
export function useOfferedLocales(tenant: string): Read<string[]> {
  return offeredRead(useTenantSettings(tenant));
}
