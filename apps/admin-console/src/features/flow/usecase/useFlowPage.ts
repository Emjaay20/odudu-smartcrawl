import type { ListExecutionsResponse, Settings } from '@odudu/contracts/admin';
import { useFlowRecord, useSettingsRecord } from '#/features/flow/repository/useFlowRecord';
import type { RecordState } from '#/shared/repository/useRecord';

export function useFlowRead(tenant: string): RecordState<ListExecutionsResponse> {
  return useFlowRecord(tenant);
}

export function useOtpRead(tenant: string): RecordState<Settings> {
  return useSettingsRecord(tenant);
}
