import type { ListExecutionsResponse, Settings } from '@odudu/contracts/admin';
import { useFlowRecord } from '#/features/flow/repository/useFlowRecord';
import type { RecordState } from '#/shared/repository/useRecord';
import { useTenantSettings } from '#/shared/repository/useTenantSettings';

export function useFlowRead(tenant: string): RecordState<ListExecutionsResponse> {
  return useFlowRecord(tenant);
}

export function useOtpRead(tenant: string): RecordState<Settings> {
  return useTenantSettings(tenant);
}
