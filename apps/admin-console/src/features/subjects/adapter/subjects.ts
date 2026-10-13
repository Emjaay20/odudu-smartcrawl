import {
  listCredentialsResponseSchema,
  lockoutSchema,
  profileSchema,
  subjectSchema,
  usernamePolicySchema,
  type AmendProfileRequest,
  type AmendSubjectRequest,
  type ListCredentialsResponse,
  type Lockout,
  type Profile,
  type Subject,
} from '@odudu/contracts/admin';
import type { CredentialChange } from '#/features/subjects/service';
import type { Gateway, GatewayResult } from '#/shared/transport/gateway';
import { readSubjectCount, readSubjectPage } from '#/shared/adapter/directory';
import { nothing, segment, tenantPath } from '#/shared/adapter/route';

export { readSubjectCount, readSubjectPage };

export function createSubject(
  gateway: Gateway,
  tenant: string,
  input: { username: string; email: string },
): Promise<GatewayResult<Subject>> {
  const t = tenantPath(tenant);
  return gateway.request('POST', `admin/tenants/${t}/subjects`, {
    body: { username: input.username, ...(input.email === '' ? {} : { email: input.email }) },
    schema: subjectSchema,
  });
}

export function readSubject(
  gateway: Gateway,
  tenant: string,
  subjectId: string,
): Promise<GatewayResult<Subject>> {
  const t = tenantPath(tenant);
  const id = segment(subjectId);
  return gateway.request('GET', `admin/tenants/${t}/subjects/${id}`, { schema: subjectSchema });
}

export function amendSubject(
  gateway: Gateway,
  tenant: string,
  subjectId: string,
  changes: AmendSubjectRequest,
  ifMatch: string,
): Promise<GatewayResult<Subject>> {
  const t = tenantPath(tenant);
  const id = segment(subjectId);
  return gateway.request('PATCH', `admin/tenants/${t}/subjects/${id}`, {
    // The server keeps no empty email, so an emptied one is cleared.
    body: changes.email === '' ? { ...changes, email: null } : changes,
    ifMatch,
    schema: subjectSchema,
  });
}

export function deleteSubject(
  gateway: Gateway,
  tenant: string,
  subjectId: string,
): Promise<GatewayResult<undefined>> {
  const t = tenantPath(tenant);
  const id = segment(subjectId);
  return gateway.request('DELETE', `admin/tenants/${t}/subjects/${id}`, { schema: nothing });
}

export function readProfile(
  gateway: Gateway,
  tenant: string,
  subjectId: string,
): Promise<GatewayResult<Profile>> {
  const t = tenantPath(tenant);
  const id = segment(subjectId);
  return gateway.request('GET', `admin/tenants/${t}/subjects/${id}/profile`, {
    schema: profileSchema,
  });
}

export function amendProfile(
  gateway: Gateway,
  tenant: string,
  subjectId: string,
  changes: AmendProfileRequest,
  ifMatch: string,
): Promise<GatewayResult<Profile>> {
  const t = tenantPath(tenant);
  const id = segment(subjectId);
  return gateway.request('PATCH', `admin/tenants/${t}/subjects/${id}/profile`, {
    // A claim the form holds as '' is one the subject does not have.
    body: Object.fromEntries(
      Object.entries(changes).map(([claim, value]) => [claim, value === '' ? null : value]),
    ),
    ifMatch,
    schema: profileSchema,
  });
}

export function readCredentials(
  gateway: Gateway,
  tenant: string,
  subjectId: string,
): Promise<GatewayResult<ListCredentialsResponse>> {
  const t = tenantPath(tenant);
  const id = segment(subjectId);
  return gateway.request('GET', `admin/tenants/${t}/subjects/${id}/credentials`, {
    schema: listCredentialsResponseSchema,
  });
}

export function deleteCredential(
  gateway: Gateway,
  tenant: string,
  subjectId: string,
  credentialId: string,
): Promise<GatewayResult<undefined>> {
  const t = tenantPath(tenant);
  const id = segment(subjectId);
  const credential = segment(credentialId);
  return gateway.request('DELETE', `admin/tenants/${t}/subjects/${id}/credentials/${credential}`, {
    schema: nothing,
  });
}

export function revokeRecoveryCodes(
  gateway: Gateway,
  tenant: string,
  subjectId: string,
): Promise<GatewayResult<undefined>> {
  const t = tenantPath(tenant);
  const id = segment(subjectId);
  return gateway.request('DELETE', `admin/tenants/${t}/subjects/${id}/recovery-codes`, {
    schema: nothing,
  });
}

export function readLockout(
  gateway: Gateway,
  tenant: string,
  subjectId: string,
): Promise<GatewayResult<Lockout>> {
  const t = tenantPath(tenant);
  const id = segment(subjectId);
  return gateway.request('GET', `admin/tenants/${t}/subjects/${id}/lockout`, {
    schema: lockoutSchema,
  });
}

export function clearLockout(
  gateway: Gateway,
  tenant: string,
  subjectId: string,
): Promise<GatewayResult<undefined>> {
  const t = tenantPath(tenant);
  const id = segment(subjectId);
  return gateway.request('DELETE', `admin/tenants/${t}/subjects/${id}/lockout`, {
    schema: nothing,
  });
}

export async function readUsernameEditable(
  gateway: Gateway,
  tenant: string,
): Promise<GatewayResult<boolean>> {
  const t = tenantPath(tenant);
  const result = await gateway.request('GET', `admin/tenants/${t}/subjects/username-policy`, {
    schema: usernamePolicySchema,
  });
  return result.ok ? { ...result, data: result.data.username_editable } : result;
}

export function changeCredential(
  gateway: Gateway,
  tenant: string,
  subjectId: string,
  change: CredentialChange,
): Promise<GatewayResult<undefined>> {
  if (change.kind === 'factor') {
    return deleteCredential(gateway, tenant, subjectId, change.credentialId);
  }
  if (change.kind === 'recovery-codes') return revokeRecoveryCodes(gateway, tenant, subjectId);
  return clearLockout(gateway, tenant, subjectId);
}
