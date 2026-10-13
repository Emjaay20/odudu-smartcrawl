import {
  assignScopeToClientResponseSchema,
  clientScopeSchema,
  listScopeClientsResponseSchema,
  scopeMappersSchema,
  setScopeRolesResponseSchema,
  type AssignScopeToClientResponse,
  type ClientScope,
  type ListScopeClientsResponse,
  type ScopeMappers,
  type SetScopeRolesResponse,
} from '@odudu/contracts/admin';
import { readScopePage } from '#/shared/adapter/directory';
import type { Gateway, GatewayResult } from '#/shared/transport/gateway';
import { adminCall, countReader, nothing } from '#/shared/adapter/route';

export { readScopePage };

export const readScopeCount = countReader('scopes');

// A new scope is its name and description; a copy carries the source's other fields too.
export interface CreateScopeInput {
  name: string;
  description: string;
  include_in_id_token?: boolean;
  include_in_access_token?: boolean;
  default_client_assignment?: 'default' | 'optional';
  consent_text?: string;
  display_order?: number;
}

export function createScope(
  gateway: Gateway,
  tenant: string,
  input: CreateScopeInput,
): Promise<GatewayResult<ClientScope>> {
  const { description, ...rest } = input;
  return adminCall(gateway, 'POST', tenant, ['scopes'], {
    body: {
      ...rest,
      ...(description === '' ? {} : { description }),
    },
    schema: clientScopeSchema,
  });
}

export function readScope(
  gateway: Gateway,
  tenant: string,
  scopeId: string,
): Promise<GatewayResult<ClientScope>> {
  return adminCall(gateway, 'GET', tenant, ['scopes', scopeId], {
    schema: clientScopeSchema,
  });
}

export function amendScope(
  gateway: Gateway,
  tenant: string,
  scopeId: string,
  changes: object,
  ifMatch: string,
): Promise<GatewayResult<ClientScope>> {
  return adminCall(gateway, 'PATCH', tenant, ['scopes', scopeId], {
    body: changes,
    ifMatch,
    schema: clientScopeSchema,
  });
}

export function deleteScope(
  gateway: Gateway,
  tenant: string,
  scopeId: string,
): Promise<GatewayResult<undefined>> {
  return adminCall(gateway, 'DELETE', tenant, ['scopes', scopeId], {
    schema: nothing,
  });
}

export function readScopeRoles(
  gateway: Gateway,
  tenant: string,
  scopeId: string,
): Promise<GatewayResult<SetScopeRolesResponse>> {
  return adminCall(gateway, 'GET', tenant, ['scopes', scopeId, 'roles'], {
    schema: setScopeRolesResponseSchema,
  });
}

export function setScopeRoles(
  gateway: Gateway,
  tenant: string,
  scopeId: string,
  roleIds: readonly string[],
  ifMatch: string,
): Promise<GatewayResult<SetScopeRolesResponse>> {
  return adminCall(gateway, 'PUT', tenant, ['scopes', scopeId, 'roles'], {
    body: { role_ids: roleIds },
    ifMatch,
    schema: setScopeRolesResponseSchema,
  });
}

export function readScopeMappers(
  gateway: Gateway,
  tenant: string,
  scopeId: string,
): Promise<GatewayResult<ScopeMappers>> {
  return adminCall(gateway, 'GET', tenant, ['scopes', scopeId, 'mappers'], {
    schema: scopeMappersSchema,
  });
}

export function setScopeMappers(
  gateway: Gateway,
  tenant: string,
  scopeId: string,
  names: readonly string[],
  ifMatch: string,
): Promise<GatewayResult<ScopeMappers>> {
  return adminCall(gateway, 'PUT', tenant, ['scopes', scopeId, 'mappers'], {
    body: { mapper_names: names },
    ifMatch,
    schema: scopeMappersSchema,
  });
}

export function readScopeClients(
  gateway: Gateway,
  tenant: string,
  scopeId: string,
  query: URLSearchParams,
): Promise<GatewayResult<ListScopeClientsResponse>> {
  return adminCall(gateway, 'GET', tenant, ['scopes', scopeId, 'clients'], {
    query,
    schema: listScopeClientsResponseSchema,
  });
}

// Answers the client's scopes alone, which is all `manage-tenant` may be told of it.
export function assignClient(
  gateway: Gateway,
  tenant: string,
  scopeId: string,
  clientDbId: string,
  assignment: 'default' | 'optional',
): Promise<GatewayResult<AssignScopeToClientResponse>> {
  return adminCall(gateway, 'PUT', tenant, ['scopes', scopeId, 'clients', clientDbId], {
    body: { assignment },
    schema: assignScopeToClientResponseSchema,
  });
}

export function unassignClient(
  gateway: Gateway,
  tenant: string,
  scopeId: string,
  clientDbId: string,
): Promise<GatewayResult<undefined>> {
  return adminCall(gateway, 'DELETE', tenant, ['scopes', scopeId, 'clients', clientDbId], {
    schema: nothing,
  });
}
