import type { Settings } from '@odudu/contracts/admin';
import type { RecordState } from '#/shared/repository/useRecord';
import { useTenantSettings } from '#/shared/repository/useTenantSettings';

export function useSettingsPage(tenant: string): RecordState<Settings> {
  return useTenantSettings(tenant);
}
