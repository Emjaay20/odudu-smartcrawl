import type { ClientScope } from '@odudu/contracts/admin';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createScope, readScopePage } from '#/features/scopes/adapter/scopes.ts';
import { useFreshRead } from '#/shared/repository/useFreshRead.ts';
import type { GatewayResult } from '#/shared/transport/gateway.ts';
import { useTransport } from '#/shared/transport/useTransport.ts';

export interface ScopeInput {
  name: string;
  description: string;
}

export interface CreateScope {
  busy: boolean;
  create: (input: ScopeInput) => Promise<GatewayResult<ClientScope>>;
  // For a creation whose answer was lost: never sent twice, looked for instead.
  find: (name: string) => Promise<GatewayResult<ClientScope | null>>;
}

export function useCreateScope(tenant: string): CreateScope {
  const { gateway } = useTransport();
  const client = useQueryClient();
  const create = useMutation({
    mutationFn: (input: ScopeInput) => createScope(gateway, tenant, input),
    onSuccess: (result) => {
      if (!result.ok) return;
      for (const key of [
        ['list', tenant, 'scopes'],
        ['count', tenant, 'scopes'],
        ['picker', tenant, 'scopes'],
      ]) {
        client.invalidateQueries({ queryKey: key }).catch(() => undefined);
      }
    },
  });
  const fresh = useFreshRead();
  return {
    busy: create.isPending || fresh.pending,
    create: (input) => create.mutateAsync(input),
    // The search is a prefix, so an exact match is picked out of its answer.
    find: (name) =>
      fresh.read(['find', tenant, 'scopes', name], async () => {
        const result = await readScopePage(
          gateway,
          tenant,
          new URLSearchParams({ name, limit: '200' }),
        );
        if (!result.ok) return result;
        return { ...result, data: result.data.items.find((scope) => scope.name === name) ?? null };
      }),
  };
}
