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

describe('admin error responses', () => {
  // An unknown admin path is answered by the server's root handler, which
  // negotiates a page for a browser; apps/server/tests/unrouted.int.test.ts
  // holds that answer to problem details under /admin.
  it('leaves the OIDC error body alone on the same instance', async () => {
    const t = await fixture.createTenant(`acme-${newId()}`);
    const res = await fixture.http.inject({
      method: 'POST',
      url: `/tenants/${t.name}/protocol/openid-connect/token`,
      payload: 'grant_type=nonsense',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.json()).toHaveProperty('error');
  });
});

// Before these, an id PostgreSQL could not parse surfaced its parse error
// as a 500 on every route with an id segment: the schemas validated the
// body, not the path.
describe('a path parameter that is not an id', () => {
  const routes = [
    'clients/not-a-uuid',
    'subjects/not-a-uuid',
    'roles/not-a-uuid',
    'subjects/not-a-uuid/sessions',
  ];

  it.each(routes)('answers %s with 400 rather than 500', async (path) => {
    const t = await fixture.createTenant(`acme-${newId()}`);
    const token = await fixture.adminToken(t.name, ['manage-clients', 'manage-users']);

    const res = await fixture.http.inject({
      method: 'GET',
      url: `/admin/tenants/${t.name}/${path}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('still answers a well-formed id that matches nothing with 404', async () => {
    const t = await fixture.createTenant(`acme-${newId()}`);
    const token = await fixture.adminToken(t.name, ['manage-clients']);

    const res = await fixture.http.inject({
      method: 'GET',
      url: `/admin/tenants/${t.name}/clients/0199aa00-0000-7000-8000-00000000dead`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });
});
