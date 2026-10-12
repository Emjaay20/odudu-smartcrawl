import type { AuditEvent } from '@odudu/contracts/admin';
import { useActivity } from '#/shared/repository/useActivity';
import type { ResourceListState } from '#/shared/service/resourceList';

export function useGroupActivity(tenant: string, id: string): ResourceListState<AuditEvent> {
  return useActivity({ tenant, resourceType: 'group', resourceId: id });
}
