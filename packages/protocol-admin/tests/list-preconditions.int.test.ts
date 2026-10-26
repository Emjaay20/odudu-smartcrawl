import { newId } from '@odudu/kernel';
import { type LightMyRequestResponse } from 'fastify';
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

function get(token: string, url: string): Promise<LightMyRequestResponse> {
  return fixture.http.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } });
}

function put(
  token: string,
  url: string,
  payload: unknown,
  ifMatch?: string,
): Promise<LightMyRequestResponse> {
  return fixture.http.inject({
    method: 'PUT',
    url,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(ifMatch === undefined ? {} : { 'if-match': ifMatch }),
    },
    payload: JSON.stringify(payload),
  });
}

async function roleId(token: string, tenantName: string, name: string): Promise<string> {
  const res = await fixture.http.inject({
    method: 'POST',
    url: `/admin/tenants/${tenantName}/roles`,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    payload: { name },
  });
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string }>().id;
}

async function createdId(
  token: string,
  tenantName: string,
  collection: string,
  body: Record<string, unknown>,
): Promise<string> {
  const res = await fixture.http.inject({
    method: 'POST',
    url: `/admin/tenants/${tenantName}/${collection}`,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    payload: body,
  });
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string }>().id;
}

// One case per route that replaces a list whole: the design spec's §9 makes
// the precondition mandatory for every one of them, and it was enforced on
// `PATCH /clients/{id}` alone. Each case reads an `ETag`, spends it, and
// finds the same header refused as stale the second time — which is exactly
// the replay that would otherwise reinstate what the first write removed.
interface ListRoute {
  readonly name: string;
  /** Returns the URL, and two successive bodies that leave different state. */
  prepare(
    token: string,
    tenantName: string,
  ): Promise<{ url: string; first: unknown; second: unknown }>;
  readonly capabilities: readonly string[];
}

const ROUTES: readonly ListRoute[] = [
  {
    name: "a subject's roles",
    capabilities: ['manage-users', 'manage-tenant'],
    prepare: async (token, tenantName) => {
      const subject = await createdId(token, tenantName, 'subjects', {
        username: `u-${newId()}`,
      });
      const role = await roleId(token, tenantName, `r-${newId()}`);
      return {
        url: `/admin/tenants/${tenantName}/subjects/${subject}/roles`,
        first: { role_ids: [role] },
        second: { role_ids: [] },
      };
    },
  },
  {
    name: "a subject's required actions",
    capabilities: ['manage-users'],
    prepare: async (token, tenantName) => {
      const subject = await createdId(token, tenantName, 'subjects', {
        username: `u-${newId()}`,
      });
      return {
        url: `/admin/tenants/${tenantName}/subjects/${subject}/required-actions`,
        first: { actions: ['configure-totp'] },
        second: { actions: [] },
      };
    },
  },
  {
    name: "a group's roles",
    capabilities: ['manage-tenant'],
    prepare: async (token, tenantName) => {
      const group = await createdId(token, tenantName, 'groups', { name: `g-${newId()}` });
      const role = await roleId(token, tenantName, `r-${newId()}`);
      return {
        url: `/admin/tenants/${tenantName}/groups/${group}/roles`,
        first: { role_ids: [role] },
        second: { role_ids: [] },
      };
    },
  },
  {
    name: "a scope's roles",
    capabilities: ['manage-tenant'],
    prepare: async (token, tenantName) => {
      const scope = await createdId(token, tenantName, 'scopes', { name: `s-${newId()}` });
      const role = await roleId(token, tenantName, `r-${newId()}`);
      return {
        url: `/admin/tenants/${tenantName}/scopes/${scope}/roles`,
        first: { role_ids: [role] },
        second: { role_ids: [] },
      };
    },
  },
  {
    name: "a scope's claim mapper bindings",
    capabilities: ['manage-tenant'],
    prepare: async (token, tenantName) => {
      const scope = await createdId(token, tenantName, 'scopes', { name: `s-${newId()}` });
      return {
        url: `/admin/tenants/${tenantName}/scopes/${scope}/mappers`,
        first: { mapper_names: ['sub'] },
        second: { mapper_names: [] },
      };
    },
  },
  {
    name: "a subject's group memberships",
    capabilities: ['manage-users', 'manage-tenant'],
    prepare: async (token, tenantName) => {
      const subject = await createdId(token, tenantName, 'subjects', {
        username: `u-${newId()}`,
      });
      const group = await createdId(token, tenantName, 'groups', { name: `g-${newId()}` });
      return {
        url: `/admin/tenants/${tenantName}/subjects/${subject}/groups`,
        first: { group_ids: [group] },
        second: { group_ids: [] },
      };
    },
  },
  {
    name: "a tenant's authentication flow",
    capabilities: ['manage-tenant'],
    prepare: (token, tenantName) =>
      Promise.resolve({
        url: `/admin/tenants/${tenantName}/flow/executions`,
        first: [
          { authenticator: 'password', requirement: 'required' },
          { authenticator: 'otp', requirement: 'conditional' },
        ],
        second: [{ authenticator: 'password', requirement: 'required' }],
      }),
  },
];

describe.each(ROUTES)('$name is replaced only under a fresh If-Match', (route) => {
  it('answers an ETag on the read and refuses a write that carries none', async () => {
    const t = await fixture.createTenant(`acme-${newId()}`);
    const token = await fixture.adminToken(t.name, [...route.capabilities]);
    const { url, first } = await route.prepare(token, t.name);

    const read = await get(token, url);
    expect(read.statusCode).toBe(200);
    expect(read.headers.etag).toEqual(expect.any(String));

    const bare = await put(token, url, first);
    expect(bare.statusCode).toBe(428);
    expect(bare.json<{ detail: string }>().detail).toContain('If-Match is required');

    // Refused, not partly applied: the read still answers what it did.
    const again = await get(token, url);
    expect(again.headers.etag).toEqual(read.headers.etag);
  });

  it('spends an ETag once, and refuses the same header replayed', async () => {
    const t = await fixture.createTenant(`acme-${newId()}`);
    const token = await fixture.adminToken(t.name, [...route.capabilities]);
    const { url, first, second } = await route.prepare(token, t.name);

    const read = await get(token, url);
    const etag = read.headers.etag;
    expect(typeof etag).toBe('string');

    const applied = await put(token, url, first, String(etag));
    expect(applied.statusCode).toBe(200);
    expect(applied.headers.etag).not.toEqual(etag);

    const replayed = await put(token, url, second, String(etag));
    expect(replayed.statusCode).toBe(412);

    const after = await get(token, url);
    expect(after.headers.etag).toEqual(applied.headers.etag);
  });

  it('counts If-Match: * as no precondition, alone or in a list', async () => {
    const t = await fixture.createTenant(`acme-${newId()}`);
    const token = await fixture.adminToken(t.name, [...route.capabilities]);
    const { url, first } = await route.prepare(token, t.name);
    const etag = String((await get(token, url)).headers.etag);

    for (const header of ['*', ` ${etag}, *`]) {
      const refused = await put(token, url, first, header);
      expect(refused.statusCode, header).toBe(428);
      expect(refused.json<{ detail: string }>().detail, header).toContain('is not accepted');
    }
    expect((await get(token, url)).headers.etag).toEqual(etag);
  });

  it('takes a list of validators and matches any member, refusing a list of stale ones', async () => {
    const t = await fixture.createTenant(`acme-${newId()}`);
    const token = await fixture.adminToken(t.name, [...route.capabilities]);
    const { url, first } = await route.prepare(token, t.name);
    const etag = String((await get(token, url)).headers.etag);

    const stale = await put(token, url, first, '"one", "two"');
    expect(stale.statusCode).toBe(412);

    const applied = await put(token, url, first, `"one", ${etag}`);
    expect(applied.statusCode).toBe(200);
  });
});

describe('a write whose If-Match is optional', () => {
  async function patchSettings(token: string, tenantName: string, ifMatch: string) {
    return fixture.http.inject({
      method: 'PATCH',
      url: `/admin/tenants/${tenantName}/settings`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'if-match': ifMatch,
      },
      payload: { client_registration_policy: 'open' },
    });
  }

  it('matches any member of a list, still takes *, and refuses a list of stale tags', async () => {
    const t = await fixture.createTenant(`acme-${newId()}`);
    const token = await fixture.adminToken(t.name, ['manage-tenant']);
    const url = `/admin/tenants/${t.name}/settings`;
    const etag = String((await get(token, url)).headers.etag);

    expect((await patchSettings(token, t.name, '"one", "two"')).statusCode).toBe(412);
    expect((await patchSettings(token, t.name, `"one", ${etag}`)).statusCode).toBe(200);
    expect((await patchSettings(token, t.name, '*')).statusCode).toBe(200);
  });
});
