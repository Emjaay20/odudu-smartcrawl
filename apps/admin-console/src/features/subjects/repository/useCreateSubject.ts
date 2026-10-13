import type { Subject } from '@odudu/contracts/admin';
import { useQueryClient } from '@tanstack/react-query';
import { useFreshRead } from '#/shared/repository/useFreshRead';
import { createSubject } from '#/features/subjects/adapter/subjects';
import { findSubject } from '#/shared/adapter/administrators';
import type { GatewayResult } from '#/shared/transport/gateway';
import { useWrite } from '#/shared/repository/useWrite';
import { useTransport } from '#/shared/transport/useTransport';

export interface CreateSubject {
  busy: boolean;
  create: (input: { username: string; email: string }) => Promise<GatewayResult<Subject>>;
  // For a creation whose answer was lost: never sent twice, looked for instead.
  find: (username: string) => Promise<GatewayResult<Subject | null>>;
}

export function useCreateSubject(tenant: string): CreateSubject {
  const { gateway } = useTransport();
  const client = useQueryClient();
  const created = (result: GatewayResult<unknown>): void => {
    if (result.ok) {
      client.invalidateQueries({ queryKey: ['list', tenant, 'subjects'] }).catch(() => undefined);
    }
  };
  const create = useWrite({
    send: (gateway, input: { username: string; email: string }) =>
      createSubject(gateway, tenant, input),
    onSuccess: created,
  });
  const fresh = useFreshRead();
  return {
    busy: create.busy || fresh.pending,
    create: create.run,
    find: (username) =>
      fresh.read(['find', tenant, 'subjects', username], () =>
        findSubject(gateway, tenant, username),
      ),
  };
}
