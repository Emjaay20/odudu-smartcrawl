import type { ClientScope } from '@odudu/contracts/admin';
import { useScopeList } from '#/features/scopes/repository/useScopeList.ts';
import { newScopeHref, scopeHref } from '#/features/scopes/service';
import { useGo } from '#/shared/repository/useGo.ts';
import type { ResourceListState } from '#/shared/service/resourceList.ts';

export interface ScopesList {
  list: ResourceListState<ClientScope>;
  createHref: string;
  open: (id: string) => void;
}

export function useScopesList(tenant: string): ScopesList {
  const list = useScopeList(tenant);
  const go = useGo();
  return {
    list,
    createHref: newScopeHref(tenant),
    open: (id) => {
      go(scopeHref(tenant, id));
    },
  };
}
