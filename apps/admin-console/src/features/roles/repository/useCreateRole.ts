import type { Role } from '@odudu/contracts/admin';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addComposite,
  createRole,
  findRole,
  readComposites,
  readRole,
} from '#/features/roles/adapter/roles';
import type { CopyRead } from '#/features/roles/service';
import { useFreshRead } from '#/shared/repository/useFreshRead';
import { useWrite } from '#/shared/repository/useWrite';
import type { GatewayResult } from '#/shared/transport/gateway';
import { useTransport } from '#/shared/transport/useTransport';

export interface RoleInput {
  name: string;
  description: string;
}

export interface CreateRole {
  busy: boolean;
  create: (input: RoleInput) => Promise<GatewayResult<Role>>;
  // Nests each child under the new role in turn, answering those that failed.
  nest: (id: string, children: readonly Role[]) => Promise<Role[]>;
  // For a creation whose answer was lost: never sent twice, looked for instead.
  find: (name: string) => Promise<GatewayResult<Role | null>>;
}

export function useCreateRole(tenant: string): CreateRole {
  const { gateway } = useTransport();
  const client = useQueryClient();
  const create = useWrite({
    send: (gateway, input: RoleInput) => createRole(gateway, tenant, input),
    onSuccess: (result) => {
      if (!result.ok) return;
      client.invalidateQueries({ queryKey: ['list', tenant, 'roles'] }).catch(() => undefined);
      client.invalidateQueries({ queryKey: ['picker', tenant, 'roles'] }).catch(() => undefined);
    },
  });
  const nest = useWrite({
    send: async (gateway, { id, children }: { id: string; children: readonly Role[] }) => {
      const failed: Role[] = [];
      for (const child of children) {
        const added = await addComposite(gateway, tenant, id, child.id, null);
        if (!added.ok) failed.push(child);
      }
      return failed;
    },
  });
  const fresh = useFreshRead();
  return {
    busy: create.busy || nest.busy || fresh.pending,
    create: create.run,
    nest: (id, children) => nest.run({ id, children }),
    find: (name) =>
      fresh.read(['find', tenant, 'roles', name], () => findRole(gateway, tenant, name)),
  };
}

export type { CopyRead };

// The role a copy is made of, and what it nests.
export function useCopySource(tenant: string, id: string | null): CopyRead {
  const { gateway } = useTransport();
  const query = useQuery({
    queryKey: ['copy', tenant, id],
    enabled: id !== null,
    queryFn: async () => {
      if (id === null) return null;
      const [role, children] = await Promise.all([
        readRole(gateway, tenant, id),
        readComposites(gateway, tenant, id),
      ]);
      return role.ok && children.ok ? { role: role.data, children: children.data.items } : null;
    },
  });
  if (id === null) return { status: 'none' };
  if (query.data === undefined) return query.isError ? { status: 'failed' } : { status: 'loading' };
  return query.data === null ? { status: 'failed' } : { status: 'ready', ...query.data };
}
