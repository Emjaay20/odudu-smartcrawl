import type { AuditEvent } from '@odudu/contracts/admin';
import { useActivity } from '#/shared/repository/useActivity.ts';
import type { ResourceListState } from '#/shared/service/resourceList.ts';

export function useScopeActivity(tenant: string, id: string): ResourceListState<AuditEvent> {
  return useActivity({ tenant, resourceType: 'scope', resourceId: id });
}
