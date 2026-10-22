import { withTenant } from '@odudu/db';
import { subjectRepository } from '@odudu/domain-identity';
import { newId } from '@odudu/kernel';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startAdminFixture, type AdminFixture } from '#/testing/admin-fixture';

let fixtureHandle: AdminFixture | undefined;
let fixture: AdminFixture;
beforeAll(async () => {
  fixtureHandle = await startAdminFixture();
  fixture = fixtureHandle;
}, 180_000);
afterAll(async () => {
  await fixtureHandle?.stop();
});

interface ClientBody {
  id: string;
  service_subject_id: string | null;
  grant_types: string[];
}

async function create(
  tenantName: string,
  token: string,
  payload: Record<string, unknown>,
): Promise<ClientBody> {
  const res = await fixture.http.inject({
    method: 'POST',
    url: `/admin/tenants/${tenantName}/clients`,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    payload: { client_id: `c-${newId()}`, ...payload },
  });
  expect(res.statusCode).toBe(201);
  return res.json<ClientBody>();
}

async function subjectExists(tenantId: string, id: string): Promise<boolean> {
  return withTenant(
    fixture.app.db,
    tenantId,
    async (tx) => (await subjectRepository(tx).byId(id)) !== null,
  );
}

describe('a client and its service account', () => {
  it('is given one when confidential, never when public, whichever door created it', async () => {
    const t = await fixture.createTenant(`acme-${newId()}`);
    const token = await fixture.adminToken(t.name, ['manage-clients']);
    const confidential = await create(t.name, token, {
      grant_types: ['client_credentials'],
      token_endpoint_auth_method: 'client_secret_basic',
    });
    const publicClient = await create(t.name, token, {
      redirect_uris: ['https://app.example/cb'],
      token_endpoint_auth_method: 'none',
    });
    expect(confidential.service_subject_id).not.toBeNull();
    expect(publicClient.service_subject_id).toBeNull();

    const tenantToken = await fixture.adminToken(t.name, ['manage-tenant']);
    await fixture.http.inject({
      method: 'PATCH',
      url: `/admin/tenants/${t.name}/settings`,
      headers: { authorization: `Bearer ${tenantToken}`, 'content-type': 'application/json' },
      payload: { client_registration_policy: 'open' },
    });
    const registered = await fixture.registerClient(t.name, {
      grant_types: ['client_credentials'],
      token_endpoint_auth_method: 'client_secret_basic',
    });
    expect(registered.statusCode).toBe(201);
    const registeredPublic = await fixture.registerClient(t.name, {
      redirect_uris: ['https://app.example/cb'],
      token_endpoint_auth_method: 'none',
    });
    expect(registeredPublic.statusCode).toBe(201);
    const read = async (clientId: string) => {
      const res = await fixture.http.inject({
        method: 'GET',
        url: `/admin/tenants/${t.name}/clients?client_id_exact=${clientId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      return res.json<{ items: ClientBody[] }>().items[0];
    };
    const confidentialRead = await read(registered.json<{ client_id: string }>().client_id);
    const publicRead = await read(registeredPublic.json<{ client_id: string }>().client_id);
    expect(confidentialRead?.service_subject_id).not.toBeNull();
    expect(publicRead?.service_subject_id).toBeNull();
  });

  it('cannot change between public and confidential, so the account never has to follow', async () => {
    const t = await fixture.createTenant(`acme-${newId()}`);
    const token = await fixture.adminToken(t.name, ['manage-clients']);
    const confidential = await create(t.name, token, {
      grant_types: ['client_credentials'],
      token_endpoint_auth_method: 'client_secret_basic',
    });
    const read = await fixture.http.inject({
      method: 'GET',
      url: `/admin/tenants/${t.name}/clients/${confidential.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await fixture.http.inject({
      method: 'PATCH',
      url: `/admin/tenants/${t.name}/clients/${confidential.id}`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'if-match': String(read.headers.etag),
      },
      payload: { token_endpoint_auth_method: 'none' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json<{ detail: string }>().detail).toContain('security model');
    const after = await fixture.http.inject({
      method: 'GET',
      url: `/admin/tenants/${t.name}/clients/${confidential.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(after.json<ClientBody>().service_subject_id).toBe(confidential.service_subject_id);
  });

  it('keeps its account when the client credentials grant is switched off', async () => {
    const t = await fixture.createTenant(`acme-${newId()}`);
    const token = await fixture.adminToken(t.name, ['manage-clients']);
    const client = await create(t.name, token, {
      grant_types: ['authorization_code', 'client_credentials'],
      redirect_uris: ['https://app.example/cb'],
      token_endpoint_auth_method: 'client_secret_basic',
    });
    const read = await fixture.http.inject({
      method: 'GET',
      url: `/admin/tenants/${t.name}/clients/${client.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await fixture.http.inject({
      method: 'PATCH',
      url: `/admin/tenants/${t.name}/clients/${client.id}`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'if-match': String(read.headers.etag),
      },
      payload: { grant_types: ['authorization_code'] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<ClientBody>();
    expect(body.grant_types).toEqual(['authorization_code']);
    expect(body.service_subject_id).toBe(client.service_subject_id);
    expect(await subjectExists(t.id, client.service_subject_id ?? '')).toBe(true);
  });

  it('is deleted with the client, and a caller of another tenant can neither reach nor remove it', async () => {
    const t = await fixture.createTenant(`acme-${newId()}`);
    const other = await fixture.createTenant(`other-${newId()}`);
    const token = await fixture.adminToken(t.name, ['manage-clients']);
    const otherToken = await fixture.adminToken(other.name, ['manage-clients']);
    const client = await create(t.name, token, {
      grant_types: ['client_credentials'],
      token_endpoint_auth_method: 'client_secret_basic',
    });
    const subject = client.service_subject_id ?? '';
    expect(await subjectExists(t.id, subject)).toBe(true);
    expect(await subjectExists(other.id, subject)).toBe(false);

    const foreign = await fixture.http.inject({
      method: 'DELETE',
      url: `/admin/tenants/${other.name}/clients/${client.id}`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(foreign.statusCode).toBe(404);
    expect(await subjectExists(t.id, subject)).toBe(true);

    const res = await fixture.http.inject({
      method: 'DELETE',
      url: `/admin/tenants/${t.name}/clients/${client.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(204);
    expect(await subjectExists(t.id, subject)).toBe(false);
  });
});
