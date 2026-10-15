import type { Role } from '@odudu/contracts/admin';
import { useRoleList } from '#/features/roles/repository/useRoleList';
import { newRoleHref, roleHref } from '#/features/roles/service';
import { useListPage, type ListPageState } from '#/shared/usecase/useListPage';

export type RolesList = ListPageState<Role>;

export function useRolesList(tenant: string): RolesList {
  return useListPage(useRoleList(tenant), newRoleHref(tenant), (id) => roleHref(tenant, id));
}
