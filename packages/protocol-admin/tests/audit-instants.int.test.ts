import { newId } from '@odudu/kernel';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startAdminFixture, type AdminFixture } from '#/testing/admin-fixture';

let handle: AdminFixture | undefined;
let fixture: AdminFixture;
let tenantName: string;
let token: string;

beforeAll(async () => {
  handle = await startAdminFixture();
  fixture = handle;
  tenantName = `instants-${newId()}`;
  await fixture.createTenant(tenantName);
  token = await fixture.adminToken(tenantName, ['view-audit']);
}, 180_000);
afterAll(async () => {
  await handle?.stop();
});

function get(tail: string) {
  return fixture.http.inject({
    method: 'GET',
    url: `/admin/tenants/${tenantName}/${tail}`,
    headers: { authorization: `Bearer ${token}` },
  });
}

describe('the instants an audit read takes', () => {
  it.each(['audit', 'audit/count', 'audit/export'])(
    'refuses a year Postgres cannot hold on %s, naming the field, not a 500',
    async (route) => {
      for (const value of ['0000-01-01T00:00:00Z', '0001-01-01T00:00:00%2B14:00']) {
        for (const name of ['from', 'to']) {
          const res = await get(`${route}?${name}=${value}`);
          expect(res.statusCode, `${route} ${name} ${value}`).toBe(400);
          expect(res.json()).toMatchObject({ status: 400 });
          expect(res.json()).toMatchObject({ errors: [{ path: name }] });
        }
      }
    },
  );
});
