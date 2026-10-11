import type { ClientScope, ScopeMappers, SetScopeRolesResponse } from '@odudu/contracts/admin';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  amendScope,
  deleteScope,
  readScope,
  readScopeMappers,
  readScopeRoles,
  setScopeMappers,
  setScopeRoles,
} from '#/features/scopes/adapter/scopes.ts';
import {
  generalPatch,
  scopeMappersRecord,
  scopeRecord,
  scopeRolesRecord,
  type GeneralValues,
} from '#/features/scopes/service';
import { useRecord, type RecordState } from '#/shared/repository/useRecord.ts';
import type { SaveInput } from '#/shared/repository/useSectionSave.ts';
import type { Gateway, GatewayResult } from '#/shared/transport/gateway.ts';
import { useTransport } from '#/shared/transport/useTransport.ts';

export function useScopeRecord(tenant: string, id: string): RecordState<ClientScope> {
  return useRecord({
    tenant,
    record: scopeRecord(id),
    read: (gateway) => readScope(gateway, tenant, id),
  });
}

export function useScopeRolesRecord(
  tenant: string,
  id: string,
): RecordState<SetScopeRolesResponse> {
  return useRecord({
    tenant,
    record: scopeRolesRecord(id),
    read: (gateway) => readScopeRoles(gateway, tenant, id),
  });
}

export function useScopeMappersRecord(tenant: string, id: string): RecordState<ScopeMappers> {
  return useRecord({
    tenant,
    record: scopeMappersRecord(id),
    read: (gateway) => readScopeMappers(gateway, tenant, id),
  });
}

// What a scope maps and hands out is read by lists, pickers and every client
// that carries it, so each is read again, but for a deleted scope's own
// reads, which would only find it gone. A deleted scope also leaves every
// client it was assigned to, so their records are stale too.
function useAfterScopeChange(tenant: string, deleted: string | null = null) {
  const client = useQueryClient();
  return <R>(result: GatewayResult<R>): GatewayResult<R> => {
    if (result.ok) {
      const gone = deleted === null ? null : scopeRecord(deleted);
      client
        .invalidateQueries({
          predicate: ({ queryKey: [kind, at, which] }) =>
            at === tenant &&
            kind === 'record' &&
            typeof which === 'string' &&
            ((which.startsWith('scopes/') && (gone === null || !which.startsWith(gone))) ||
              (deleted !== null && which.startsWith('clients/'))),
        })
        .catch(() => undefined);
      for (const key of [
        ['list', tenant, 'scopes'],
        ['count', tenant, 'scopes'],
        ['picker', tenant, 'scopes'],
      ]) {
        client.invalidateQueries({ queryKey: key }).catch(() => undefined);
      }
    }
    return result;
  };
}

export interface DescriptionValues extends Readonly<Record<string, unknown>> {
  description: string;
}

export interface TokenValues extends Readonly<Record<string, unknown>> {
  include_in_id_token: boolean;
  include_in_access_token: boolean;
}

export interface AssignmentValues extends Readonly<Record<string, unknown>> {
  default_client_assignment: string;
}

export interface ConsentValues extends Readonly<Record<string, unknown>> {
  consent_text: string;
  display_order: string;
}

export interface RoleValues extends Readonly<Record<string, unknown>> {
  role_ids: readonly string[];
}

export interface MapperValues extends Readonly<Record<string, unknown>> {
  mapper_names: readonly string[];
}

export function useScopeSaves(tenant: string, id: string) {
  const after = useAfterScopeChange(tenant);
  return {
    general: async (
      gateway: Gateway,
      { changes, ifMatch }: { changes: GeneralValues; ifMatch: string },
    ) => after(await amendScope(gateway, tenant, id, generalPatch(changes), ifMatch)),
    roles: async (gateway: Gateway, { values, ifMatch }: SaveInput<RoleValues>) =>
      after(await setScopeRoles(gateway, tenant, id, [...new Set(values.role_ids)], ifMatch)),
    mappers: async (gateway: Gateway, { values, ifMatch }: SaveInput<MapperValues>) =>
      after(await setScopeMappers(gateway, tenant, id, values.mapper_names, ifMatch)),
  };
}

export interface ScopeDeletion {
  busy: boolean;
  run: () => Promise<GatewayResult<undefined>>;
}

export function useScopeDeletion(tenant: string, id: string): ScopeDeletion {
  const { gateway } = useTransport();
  const after = useAfterScopeChange(tenant, id);
  const mutation = useMutation({
    mutationFn: async () => after(await deleteScope(gateway, tenant, id)),
  });
  return { busy: mutation.isPending, run: () => mutation.mutateAsync() };
}
