import type { ClientScope, ScopeMappers, SetScopeRolesResponse } from '@odudu/contracts/admin';
import { useQueryClient } from '@tanstack/react-query';
import {
  amendScope,
  deleteScope,
  readScope,
  readScopeMappers,
  readScopeRoles,
  setScopeMappers,
  setScopeRoles,
} from '#/features/scopes/adapter/scopes';
import {
  generalPatch,
  scopeMappersRecord,
  scopeRecord,
  scopeRolesRecord,
  type GeneralValues,
} from '#/features/scopes/service';
import { uniqueIds } from '#/shared/service/ids';
import { useRecord, type RecordState } from '#/shared/repository/useRecord';
import type { SaveInput } from '#/shared/repository/useSectionSave';
import type { Gateway, GatewayResult } from '#/shared/transport/gateway';
import { useWrite, type Write } from '#/shared/repository/useWrite';
import type { RoleValues } from '#/shared/service/sectionValues';

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

export function useScopeMappersRecord(
  tenant: string,
  id: string,
  enabled = true,
): RecordState<ScopeMappers> {
  return useRecord({
    tenant,
    enabled,
    record: scopeMappersRecord(id),
    read: (gateway) => readScopeMappers(gateway, tenant, id),
  });
}

// A scope's change is read again by the lists and pickers that show it, and
// by its own records, except those of a deleted scope, which would only find
// it gone. A deleted scope also leaves every
// client it was assigned to; those clients' pages are not open here, so what
// the console holds of them is dropped, not marked stale.
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
            which.startsWith('scopes/') &&
            (gone === null || !which.startsWith(gone)),
        })
        .catch(() => undefined);
      if (deleted !== null) {
        client.removeQueries({
          predicate: ({ queryKey: [kind, at, which] }) =>
            at === tenant &&
            kind === 'record' &&
            typeof which === 'string' &&
            which.startsWith('clients/'),
        });
      }
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
      after(await setScopeRoles(gateway, tenant, id, uniqueIds(values.role_ids), ifMatch)),
    mappers: async (gateway: Gateway, { values, ifMatch }: SaveInput<MapperValues>) =>
      after(await setScopeMappers(gateway, tenant, id, values.mapper_names, ifMatch)),
  };
}

export function useScopeDeletion(
  tenant: string,
  id: string,
): Write<void, GatewayResult<undefined>> {
  const after = useAfterScopeChange(tenant, id);
  return useWrite({
    send: async (gateway) => after(await deleteScope(gateway, tenant, id)),
  });
}
