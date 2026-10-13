import type { AssignScopeToClientResponse, ScopeClient } from '@odudu/contracts/admin';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { readScopeClients } from '#/features/scopes/adapter/scopes';
import { assignScope, unassignScope } from '#/shared/adapter/scopeAssignment';
import { withoutScope, withScopes } from '#/features/scopes/service';
import { recordKey, type RecordEntry } from '#/shared/repository/useRecord';
import { useListPages } from '#/shared/repository/useResourceList';
import type { ListStatus } from '#/shared/service/resourceList';
import type { GatewayResult } from '#/shared/transport/gateway';
import { useTransport } from '#/shared/transport/useTransport';

// What the console holds of a client that a scope's assignment changes.
interface ClientRecord {
  scopes: AssignScopeToClientResponse['scopes'];
}

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
export function useScopeClients(tenant: string, id: string, enabled = true): ScopeClients {
  const pages = useListPages({
    key: ['scope-clients', tenant, id],
    query: new URLSearchParams(),
    cursor: undefined,
    enabled,
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

// An assignment changes the client's own ETag, which covers its scopes, and
// the answer carries the new one. A client the console already holds is
// rebased on it, so its page saves on that ETag even before it has read the
// client again. Without an ETag in the answer, or a record to rebase, what is
// held is dropped instead, and the page waits for a fresh read.
function useAfterAssignment(tenant: string, id: string) {
  const client = useQueryClient();
  return (
    clientDbId: string,
    answered: GatewayResult<unknown> | undefined,
    rebase: (held: ClientRecord) => ClientRecord,
  ): void => {
    client.invalidateQueries({ queryKey: ['scope-clients', tenant, id] }).catch(() => undefined);
    const key = recordKey(tenant, `clients/${clientDbId}`);
    const held = client.getQueryData<RecordEntry<ClientRecord>>(key);
    if (answered?.ok === true && answered.etag !== null && held !== undefined) {
      client.setQueryData<RecordEntry<ClientRecord>>(key, {
        by: 'save',
        result: { ...held.result, etag: answered.etag, data: rebase(held.result.data) },
      });
    } else {
      client.removeQueries({ queryKey: key, exact: true });
    }
  };
}

export function useClientAssignment(tenant: string, id: string) {
  const { gateway } = useTransport();
  const settled = useAfterAssignment(tenant, id);
  const assign = useMutation({
    mutationFn: ({ clientId, assignment }: AssignInput) =>
      assignScope(gateway, tenant, id, clientId, assignment),
    onSettled: (result, _error, { clientId }) => {
      settled(clientId, result, (held) =>
        result?.ok === true ? withScopes(held, result.data.scopes) : held,
      );
    },
  });
  const unassign = useMutation({
    mutationFn: ({ clientId }: { clientId: string }) =>
      unassignScope(gateway, tenant, id, clientId),
    onSettled: (result, _error, { clientId }) => {
      settled(clientId, result, (held) => withoutScope(held, id));
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
