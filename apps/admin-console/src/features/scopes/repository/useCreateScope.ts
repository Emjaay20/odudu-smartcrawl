import type { ClientScope } from '@odudu/contracts/admin';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createScope,
  readScope,
  readScopeMappers,
  readScopePage,
  readScopeRoles,
  setScopeMappers,
  setScopeRoles,
  type CreateScopeInput,
} from '#/features/scopes/adapter/scopes';
import type { CopyRead } from '#/features/scopes/service';
import { useFreshRead } from '#/shared/repository/useFreshRead';
import { useWrite } from '#/shared/repository/useWrite';
import type { GatewayResult } from '#/shared/transport/gateway';
import { useTransport } from '#/shared/transport/useTransport';

export type ScopeInput = CreateScopeInput;

export interface CreateScope {
  busy: boolean;
  create: (input: ScopeInput) => Promise<GatewayResult<ClientScope>>;
  // For a creation whose answer was lost: never sent twice, looked for instead.
  find: (name: string) => Promise<GatewayResult<ClientScope | null>>;
  // Maps the roles and binds the mappers of a copy, one write each on the tag
  // its own read answers, and answers the parts that did not take.
  fill: (id: string, roleIds: readonly string[], mapperNames: readonly string[]) => Promise<Part[]>;
}

type Part = 'roles' | 'mappers';

export function useCreateScope(tenant: string): CreateScope {
  const { gateway } = useTransport();
  const client = useQueryClient();
  const create = useWrite({
    send: (gateway, input: ScopeInput) => createScope(gateway, tenant, input),
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
  const setRoles = useWrite({
    send: (
      gateway,
      { id, ids, ifMatch }: { id: string; ids: readonly string[]; ifMatch: string },
    ) => setScopeRoles(gateway, tenant, id, ids, ifMatch),
  });
  const setMappers = useWrite({
    send: (
      gateway,
      { id, names, ifMatch }: { id: string; names: readonly string[]; ifMatch: string },
    ) => setScopeMappers(gateway, tenant, id, names, ifMatch),
  });
  const fresh = useFreshRead();
  return {
    busy: create.busy || setRoles.busy || setMappers.busy || fresh.pending,
    fill: async (id, roleIds, mapperNames) => {
      const missed: Part[] = [];
      if (roleIds.length > 0) {
        const read = await fresh.read(['copy-etag', tenant, id, 'roles'], () =>
          readScopeRoles(gateway, tenant, id),
        );
        const set =
          read.ok && read.etag !== null
            ? await setRoles.run({ id, ids: roleIds, ifMatch: read.etag })
            : read;
        if (!set.ok) missed.push('roles');
      }
      if (mapperNames.length > 0) {
        const read = await fresh.read(['copy-etag', tenant, id, 'mappers'], () =>
          readScopeMappers(gateway, tenant, id),
        );
        const set =
          read.ok && read.etag !== null
            ? await setMappers.run({ id, names: mapperNames, ifMatch: read.etag })
            : read;
        if (!set.ok) missed.push('mappers');
      }
      return missed;
    },
    create: create.run,
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

// The scope a copy is made of, with the roles it maps and the mappers it binds.
export function useCopySource(tenant: string, id: string | null): CopyRead {
  const { gateway } = useTransport();
  const query = useQuery({
    queryKey: ['copy', tenant, 'scopes', id],
    enabled: id !== null,
    queryFn: async () => {
      if (id === null) return null;
      const [scope, roles, mappers] = await Promise.all([
        readScope(gateway, tenant, id),
        readScopeRoles(gateway, tenant, id),
        readScopeMappers(gateway, tenant, id),
      ]);
      return scope.ok && roles.ok && mappers.ok
        ? { scope: scope.data, roles: roles.data.items, bound: mappers.data.bound }
        : null;
    },
  });
  if (id === null) return { status: 'none' };
  if (query.data === undefined) return query.isError ? { status: 'failed' } : { status: 'loading' };
  return query.data === null ? { status: 'failed' } : { status: 'ready', ...query.data };
}
