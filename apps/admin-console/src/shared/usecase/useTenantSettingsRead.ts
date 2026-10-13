import type { Settings } from '@odudu/contracts/admin';
import type { RecordState } from '#/shared/repository/useRecord';
import { useTenantSettings } from '#/shared/repository/useTenantSettings';

// The tenant's settings record for a page that shows or edits one of them.
export function useTenantSettingsRead(tenant: string): RecordState<Settings> {
  return useTenantSettings(tenant);
}
