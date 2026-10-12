import type { AuditEvent } from '@odudu/contracts/admin';
import { useActivity } from '#/shared/repository/useActivity';
import type { ResourceListState } from '#/shared/service/resourceList';

export function useRoleActivity(tenant: string, id: string): ResourceListState<AuditEvent> {
  return useActivity({ tenant, resourceType: 'role', resourceId: id });
}
