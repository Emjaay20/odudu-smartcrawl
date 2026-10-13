import {
  issuePasswordResponseSchema,
  setRolesResponseSchema,
  subjectSchema,
  type IssuePasswordResponse,
  type ListClientsResponse,
  type ListRolesResponse,
  type SetRolesResponse,
  type Subject,
} from '@odudu/contracts/admin';
import { readClientPage, readRolePage, readSubjectPage } from '#/shared/adapter/directory';
import type { Gateway, GatewayResult } from '#/shared/transport/gateway';
import { adminCall, firstMatch } from '#/shared/adapter/route';

export function createSubject(
  gateway: Gateway,
  tenant: string,
  input: { username: string; email: string },
): Promise<GatewayResult<Subject>> {
  return adminCall(gateway, 'POST', tenant, ['subjects'], {
    body: { username: input.username, ...(input.email === '' ? {} : { email: input.email }) },
    schema: subjectSchema,
  });
}

// `username` is a prefix search, sorted by username: the exact one comes first.
export async function findSubject(
  gateway: Gateway,
  tenant: string,
  username: string,
): Promise<GatewayResult<Subject | null>> {
  const result = await readSubjectPage(gateway, tenant, new URLSearchParams({ username }));
  return firstMatch(result, (subject) => subject.username === username);
}

export function issuePassword(
  gateway: Gateway,
  tenant: string,
  subjectId: string,
): Promise<GatewayResult<IssuePasswordResponse>> {
  return adminCall(gateway, 'POST', tenant, ['subjects', subjectId, 'password'], {
    schema: issuePasswordResponseSchema,
  });
}

// A client_id search is a prefix, so a tenant's own `odudu-admin-x` comes
// back too; the caller keeps the built-in one.
export function readAdminClients(
  gateway: Gateway,
  tenant: string,
): Promise<GatewayResult<ListClientsResponse>> {
  return readClientPage(gateway, tenant, new URLSearchParams({ client_id: 'odudu-admin' }));
}

export function readClientRoles(
  gateway: Gateway,
  tenant: string,
  clientId: string,
  name?: string,
): Promise<GatewayResult<ListRolesResponse>> {
  const query = new URLSearchParams({ client: clientId });
  if (name !== undefined) query.set('name', name);
  return readRolePage(gateway, tenant, query);
}

export function readSubjectRoles(
  gateway: Gateway,
  tenant: string,
  subjectId: string,
): Promise<GatewayResult<SetRolesResponse>> {
  return adminCall(gateway, 'GET', tenant, ['subjects', subjectId, 'roles'], {
    schema: setRolesResponseSchema,
  });
}

export function setSubjectRoles(
  gateway: Gateway,
  tenant: string,
  subjectId: string,
  roleIds: readonly string[],
  ifMatch: string,
): Promise<GatewayResult<SetRolesResponse>> {
  return adminCall(gateway, 'PUT', tenant, ['subjects', subjectId, 'roles'], {
    body: { role_ids: roleIds },
    ifMatch,
    schema: setRolesResponseSchema,
  });
}
