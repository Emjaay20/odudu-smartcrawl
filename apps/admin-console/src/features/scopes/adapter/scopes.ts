import {
  assignScopeToClientResponseSchema,
  clientScopeSchema,
  countResponseSchema,
  listScopeClientsResponseSchema,
  scopeMappersSchema,
  setScopeRolesResponseSchema,
  type AssignScopeToClientResponse,
  type ClientScope,
  type CountResponse,
  type ListScopeClientsResponse,
  type ScopeMappers,
  type SetScopeRolesResponse,
} from '@odudu/contracts/admin';
import { z } from 'zod';
import { readScopePage } from '#/shared/adapter/directory';
import type { Gateway, GatewayResult } from '#/shared/transport/gateway';

export { readScopePage };

const nothing = z.undefined();

function path(tenant: string): string {
  return encodeURIComponent(tenant);
}

function segment(id: string): string {
  return encodeURIComponent(id);
}

export function readScopeCount(
  gateway: Gateway,
  tenant: string,
  query: URLSearchParams,
): Promise<GatewayResult<CountResponse>> {
  return gateway.request('GET', `admin/tenants/${path(tenant)}/scopes/count?${query.toString()}`, {
    schema: countResponseSchema,
  });
}

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
  return gateway.request('POST', `admin/tenants/${path(tenant)}/scopes`, {
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
  return gateway.request('GET', `admin/tenants/${path(tenant)}/scopes/${segment(scopeId)}`, {
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
  return gateway.request('PATCH', `admin/tenants/${path(tenant)}/scopes/${segment(scopeId)}`, {
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
  return gateway.request('DELETE', `admin/tenants/${path(tenant)}/scopes/${segment(scopeId)}`, {
    schema: nothing,
  });
}

export function readScopeRoles(
  gateway: Gateway,
  tenant: string,
  scopeId: string,
): Promise<GatewayResult<SetScopeRolesResponse>> {
  return gateway.request('GET', `admin/tenants/${path(tenant)}/scopes/${segment(scopeId)}/roles`, {
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
  return gateway.request('PUT', `admin/tenants/${path(tenant)}/scopes/${segment(scopeId)}/roles`, {
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
  return gateway.request(
    'GET',
    `admin/tenants/${path(tenant)}/scopes/${segment(scopeId)}/mappers`,
    { schema: scopeMappersSchema },
  );
}

export function setScopeMappers(
  gateway: Gateway,
  tenant: string,
  scopeId: string,
  names: readonly string[],
  ifMatch: string,
): Promise<GatewayResult<ScopeMappers>> {
  return gateway.request(
    'PUT',
    `admin/tenants/${path(tenant)}/scopes/${segment(scopeId)}/mappers`,
    { body: { mapper_names: names }, ifMatch, schema: scopeMappersSchema },
  );
}

export function readScopeClients(
  gateway: Gateway,
  tenant: string,
  scopeId: string,
  query: URLSearchParams,
): Promise<GatewayResult<ListScopeClientsResponse>> {
  return gateway.request(
    'GET',
    `admin/tenants/${path(tenant)}/scopes/${segment(scopeId)}/clients?${query.toString()}`,
    { schema: listScopeClientsResponseSchema },
  );
}

// Answers the client's scopes alone, which is all `manage-tenant` may be told of it.
export function assignClient(
  gateway: Gateway,
  tenant: string,
  scopeId: string,
  clientDbId: string,
  assignment: 'default' | 'optional',
): Promise<GatewayResult<AssignScopeToClientResponse>> {
  return gateway.request(
    'PUT',
    `admin/tenants/${path(tenant)}/scopes/${segment(scopeId)}/clients/${segment(clientDbId)}`,
    { body: { assignment }, schema: assignScopeToClientResponseSchema },
  );
}

export function unassignClient(
  gateway: Gateway,
  tenant: string,
  scopeId: string,
  clientDbId: string,
): Promise<GatewayResult<undefined>> {
  return gateway.request(
    'DELETE',
    `admin/tenants/${path(tenant)}/scopes/${segment(scopeId)}/clients/${segment(clientDbId)}`,
    { schema: nothing },
  );
}
