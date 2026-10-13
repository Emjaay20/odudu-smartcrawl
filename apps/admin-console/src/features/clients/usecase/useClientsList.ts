import type { Client } from '@odudu/contracts/admin';
import { useClientList } from '#/features/clients/repository/useClientList';
import { clientHref, newClientHref } from '#/features/clients/service';
import { useListPage, type ListPageState } from '#/shared/usecase/useListPage';

export type ClientsList = ListPageState<Client>;

export function useClientsList(tenant: string): ClientsList {
  return useListPage(useClientList(tenant), newClientHref(tenant), (id) => clientHref(tenant, id));
}
