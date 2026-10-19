import { BIDI_REFUSED, BIDI_REFUSED_MESSAGE } from '@odudu/contracts';
import { tenantDocumentSchema } from '@odudu/contracts/admin';
import { newId } from '@odudu/kernel';
import { type LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startAdminFixture, type AdminFixture } from '#/testing/admin-fixture';

const RLO = String.fromCodePoint(0x202e);
const ISOLATE = String.fromCodePoint(0x2066);
const RLM = String.fromCodePoint(0x200f);

let fixtureHandle: AdminFixture | undefined;
let fixture: AdminFixture;
beforeAll(async () => {
  fixtureHandle = await startAdminFixture();
  fixture = fixtureHandle;
}, 180_000);
afterAll(async () => {
  await fixtureHandle?.stop();
});

interface Refusal {
  readonly status: number;
  readonly errors: readonly { path: string; message: string; code?: string }[];
}

function refusalOf(res: LightMyRequestResponse): Refusal {
  return {
    status: res.statusCode,
    errors: res.json<{ errors?: Refusal['errors'] }>().errors ?? [],
  };
}

function expectRefused(res: LightMyRequestResponse, path: string): void {
  expect(refusalOf(res)).toEqual({
    status: 400,
    errors: [{ path, message: BIDI_REFUSED_MESSAGE, code: BIDI_REFUSED }],
  });
}

function send(
  method: 'POST' | 'PATCH' | 'PUT',
  url: string,
  token: string,
  payload: unknown,
  ifMatch?: string,
): Promise<LightMyRequestResponse> {
  return fixture.http.inject({
    method,
    url,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(ifMatch === undefined ? {} : { 'if-match': ifMatch }),
    },
    payload: JSON.stringify(payload),
  });
}

async function etagOf(url: string, token: string): Promise<string> {
  const res = await fixture.http.inject({
    method: 'GET',
    url,
    headers: { authorization: `Bearer ${token}` },
  });
  const etag = res.headers.etag;
  if (typeof etag !== 'string') throw new Error(`no etag from ${url}: ${res.payload}`);
  return etag;
}

async function subject(tenant: string, token: string): Promise<string> {
  const res = await send('POST', `/admin/tenants/${tenant}/subjects`, token, {
    username: `ada-${newId()}`,
  });
  expect(res.statusCode, res.payload).toBe(201);
  return res.json<{ id: string }>().id;
}

describe('the admin API refuses a bidirectional control in a typed identity or name field', () => {
  it('when a subject is created, naming the username and carrying the code', async () => {
    const t = await fixture.createTenant(`bidi-${newId()}`);
    const token = await fixture.adminToken(t.name, ['manage-users', 'view-users']);
    for (const control of [RLO, ISOLATE]) {
      const res = await send('POST', `/admin/tenants/${t.name}/subjects`, token, {
        username: `ada${control}`,
      });
      expectRefused(res, 'username');
    }
    const listed = await fixture.http.inject({
      method: 'GET',
      url: `/admin/tenants/${t.name}/subjects`,
      headers: { authorization: `Bearer ${token}` },
    });
    const names = listed.json<{ items: { username: string | null }[] }>().items;
    expect(names.filter((item) => item.username?.startsWith('ada'))).toEqual([]);
  });

  it('when the control arrives as a JSON escape, which is decoded before it is checked', async () => {
    const t = await fixture.createTenant(`bidi-${newId()}`);
    const token = await fixture.adminToken(t.name, ['manage-users']);
    const res = await fixture.http.inject({
      method: 'POST',
      url: `/admin/tenants/${t.name}/subjects`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: String.raw`{"username":"ada\u202e"}`,
    });
    expectRefused(res, 'username');
  });

  it('when a subject is renamed, leaving the name as it was', async () => {
    const t = await fixture.createTenant(`bidi-${newId()}`);
    const token = await fixture.adminToken(t.name, ['manage-users', 'view-users']);
    const id = await subject(t.name, token);
    const url = `/admin/tenants/${t.name}/subjects/${id}`;
    const before = await etagOf(url, token);
    expectRefused(await send('PATCH', url, token, { username: `x${RLO}y` }, before), 'username');
    expect(await etagOf(url, token)).toBe(before);
  });

  it.each(['name', 'given_name', 'family_name', 'middle_name', 'nickname', 'preferred_username'])(
    'in the profile %s',
    async (field) => {
      const t = await fixture.createTenant(`bidi-${newId()}`);
      const token = await fixture.adminToken(t.name, ['manage-users', 'view-users']);
      const id = await subject(t.name, token);
      const url = `/admin/tenants/${t.name}/subjects/${id}/profile`;
      expectRefused(await send('PATCH', url, token, { [field]: `x${RLO}` }), field);
    },
  );

  it('accepts Arabic and Hebrew with their marks, in a username and in profile names', async () => {
    const t = await fixture.createTenant(`bidi-${newId()}`);
    const token = await fixture.adminToken(t.name, ['manage-users', 'view-users']);
    const created = await send('POST', `/admin/tenants/${t.name}/subjects`, token, {
      username: `مستخدم-${newId()}`,
    });
    expect(created.statusCode, created.payload).toBe(201);
    const hebrew = await send('POST', `/admin/tenants/${t.name}/subjects`, token, {
      username: `עברית-${newId()}`,
    });
    expect(hebrew.statusCode, hebrew.payload).toBe(201);
    const id = created.json<{ id: string }>().id;
    const profile = await send('PATCH', `/admin/tenants/${t.name}/subjects/${id}/profile`, token, {
      given_name: 'שלום',
      family_name: `س${RLM}ل`,
    });
    expect(profile.statusCode, profile.payload).toBe(200);
  });

  it('in the display name of a tenant being created or amended', async () => {
    const token = await fixture.systemAdminToken(['manage-tenants']);
    expectRefused(
      await send('POST', '/admin/tenants', token, {
        name: `bidi-${newId()}`,
        display_name: `Acme${RLO}`,
      }),
      'display_name',
    );
    const t = await fixture.createTenant(`bidi-${newId()}`);
    const own = await fixture.adminToken(t.name, ['manage-tenant']);
    const url = `/admin/tenants/${t.name}`;
    const before = await etagOf(url, own);
    expectRefused(
      await send('PATCH', url, own, { display_name: `Acme${RLO}` }, before),
      'display_name',
    );
    const ok = await send('PATCH', url, own, { display_name: 'شركة' }, before);
    expect(ok.statusCode, ok.payload).toBe(200);
  });

  it('in the display name set through the settings door', async () => {
    const t = await fixture.createTenant(`bidi-${newId()}`);
    const token = await fixture.adminToken(t.name, ['manage-tenant']);
    const res = await send('PATCH', `/admin/tenants/${t.name}/settings`, token, {
      display_name: `Acme${RLO}`,
    });
    expectRefused(res, 'display_name');
  });

  it('in a role or group name', async () => {
    const t = await fixture.createTenant(`bidi-${newId()}`);
    const roles = await fixture.adminToken(t.name, ['manage-tenant']);
    expectRefused(
      await send('POST', `/admin/tenants/${t.name}/roles`, roles, { name: `r${RLO}` }),
      'name',
    );
    const groups = await fixture.adminToken(t.name, ['manage-tenant']);
    expectRefused(
      await send('POST', `/admin/tenants/${t.name}/groups`, groups, { name: `g${RLO}` }),
      'name',
    );
  });

  it('in a client name, on creation and on amendment', async () => {
    const t = await fixture.createTenant(`bidi-${newId()}`);
    const token = await fixture.adminToken(t.name, ['manage-clients']);
    const base = {
      redirect_uris: ['https://app.example/callback'],
      token_endpoint_auth_method: 'none',
    };
    expectRefused(
      await send('POST', `/admin/tenants/${t.name}/clients`, token, {
        client_id: `c-${newId()}`,
        name: `Bank${RLO}`,
        ...base,
      }),
      'name',
    );
    const viaMetadata = await send('POST', `/admin/tenants/${t.name}/clients`, token, {
      client_id: `c-${newId()}`,
      client_name: `Bank${RLO}`,
      ...base,
    });
    expect(refusalOf(viaMetadata).status).toBe(400);
    expect(viaMetadata.payload).toContain('client_name');

    const created = await send('POST', `/admin/tenants/${t.name}/clients`, token, {
      client_id: `c-${newId()}`,
      name: 'Bank',
      ...base,
    });
    expect(created.statusCode, created.payload).toBe(201);
    const url = `/admin/tenants/${t.name}/clients/${created.json<{ id: string }>().id}`;
    const before = await etagOf(url, token);
    expectRefused(await send('PATCH', url, token, { name: `Bank${RLO}` }, before), 'name');
  });

  it('in a tenant import: the display name, and each name inside its document', async () => {
    const token = await fixture.systemAdminToken(['manage-tenants', 'tenant-admin']);
    const source = await fixture.createTenant(`bidi-${newId()}`);
    const exported = await fixture.http.inject({
      method: 'GET',
      url: `/admin/tenants/${source.name}/export?include=subjects`,
      headers: { authorization: `Bearer ${token}` },
    });
    const document = tenantDocumentSchema.parse(JSON.parse(exported.payload));
    const post = (name: string, body: Record<string, unknown>) =>
      send('POST', '/admin/tenant-imports', token, { name, ...body });

    const display = await post(`bidi-${newId()}`, { display_name: `A${RLO}`, document });
    expectRefused(display, 'display_name');

    const hostile = {
      ...document,
      settings: { ...document.settings, display_name: `S${RLO}` },
      roles: [
        ...document.roles,
        {
          name: `R${RLO}`,
          client: null,
          description: null,
          default_for_new_subjects: false,
          builtin: false,
          composites: [],
        },
      ],
      subjects: [
        {
          username: `u${RLO}`,
          email: null,
          enabled: true,
          profile: { ...(document.subjects?.[0]?.profile ?? {}), given_name: `g${RLO}` },
          roles: [],
          groups: [],
          required_actions: [],
        },
      ],
    };
    const res = await post(`bidi-${newId()}`, { document: hostile });
    expect(res.statusCode).toBe(400);
    const refused = res
      .json<{ errors: { path: string; message: string; code?: string }[] }>()
      .errors.filter((error) => error.message === BIDI_REFUSED_MESSAGE);
    expect(refused.map((error) => error.path).sort()).toEqual([
      'document.roles[' + String(document.roles.length) + '].name',
      'document.settings.display_name',
      'document.subjects[0].profile.given_name',
      'document.subjects[0].username',
    ]);
    expect(refused.every((error) => error.code === BIDI_REFUSED)).toBe(true);
  });
});
