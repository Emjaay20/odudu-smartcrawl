import type { ScopeClient } from '@odudu/contracts/admin';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  assignClient,
  readScopeClients,
  unassignClient,
} from '#/features/scopes/adapter/scopes.ts';
import { useListPages } from '#/shared/repository/useResourceList.ts';
import type { ListStatus } from '#/shared/service/resourceList.ts';
import type { GatewayResult } from '#/shared/transport/gateway.ts';
import { useTransport } from '#/shared/transport/useTransport.ts';

export interface ScopeClients {
  status: ListStatus;
  rows: readonly ScopeClient[];
  more: boolean;
  loadingMore: boolean;
  loadMoreFailed: boolean;
  loadMore: () => void;
  retry: () => void;
}

// The clients that carry the scope, a page at a time: the server answers in
// the order of its index, so "Load more" is the only way through.
export function useScopeClients(tenant: string, id: string): ScopeClients {
  const pages = useListPages({
    key: ['scope-clients', tenant, id],
    query: new URLSearchParams(),
    cursor: undefined,
    read: (gateway, query) => readScopeClients(gateway, tenant, id, query),
  });
  return {
    status: pages.status,
    rows: pages.rows,
    more: pages.next !== null,
    loadingMore: pages.loadingMore,
    loadMoreFailed: pages.loadMoreFailed,
    loadMore: pages.loadMore,
    retry: pages.retry,
  };
}

export interface AssignInput {
  clientId: string;
  assignment: 'default' | 'optional';
}

export interface ClientChange<A, R> {
  busy: boolean;
  run: (arg: A) => Promise<GatewayResult<R>>;
}

// An assignment changes the client's own ETag, which covers its scopes. Its
// page is not open here, so what the console holds of the client is dropped
// rather than marked stale: a page opened later would otherwise show the old
// record and save on its ETag before the fresh read arrived.
function useAfterAssignment(tenant: string, id: string) {
  const client = useQueryClient();
  return (clientDbId: string): void => {
    client.invalidateQueries({ queryKey: ['scope-clients', tenant, id] }).catch(() => undefined);
    client.removeQueries({
      predicate: ({ queryKey: [kind, at, which] }) =>
        at === tenant &&
        kind === 'record' &&
        typeof which === 'string' &&
        (which === `clients/${clientDbId}` || which.startsWith(`clients/${clientDbId}/`)),
    });
  };
}

export function useClientAssignment(tenant: string, id: string) {
  const { gateway } = useTransport();
  const settled = useAfterAssignment(tenant, id);
  const assign = useMutation({
    mutationFn: ({ clientId, assignment }: AssignInput) =>
      assignClient(gateway, tenant, id, clientId, assignment),
    onSettled: (_result, _error, { clientId }) => {
      settled(clientId);
    },
  });
  const unassign = useMutation({
    mutationFn: ({ clientId }: { clientId: string }) =>
      unassignClient(gateway, tenant, id, clientId),
    onSettled: (_result, _error, { clientId }) => {
      settled(clientId);
    },
  });
  return {
    assign: {
      busy: assign.isPending,
      run: (arg: AssignInput) => assign.mutateAsync(arg),
    },
    unassign: {
      busy: unassign.isPending,
      run: (arg: { clientId: string }) => unassign.mutateAsync(arg),
    },
  };
}
