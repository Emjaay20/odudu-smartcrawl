import type { Settings } from '@odudu/contracts/admin';
import { readTenantSettings } from '#/shared/adapter/tenantSettings';
import { useRecord, type RecordState } from '#/shared/repository/useRecord';
import { TENANT_SETTINGS_RECORD } from '#/shared/service/tenantSettings';

export function useTenantSettings(tenant: string): RecordState<Settings> {
  return useRecord({
    tenant,
    record: TENANT_SETTINGS_RECORD,
    read: (gateway) => readTenantSettings(gateway, tenant),
  });
}
