import { expect, it } from 'vitest';
import { readCount, readJwks, readKeys, readLatestAudit } from '#/features/overview/adapter';
import { fakeTransport, inTurn, json } from '#/testing/fakeTransport';

it("reads the tenant's JWKS through the gateway", async () => {
  const jwks = { keys: [{ kty: 'EC', kid: 'k1', alg: 'ES256', use: 'sig', crv: 'P-256' }] };
  const fake = fakeTransport({ 'GET /console/api/tenants/acme/jwks': json(jwks) });
  expect(await readJwks(fake.transport.gateway, 'acme')).toMatchObject({ ok: true, data: jwks });
});

it('counts each collection at its own route', async () => {
  const count = json({ count: 3, capped: false });
  const fake = fakeTransport({
    'GET /console/api/admin/tenants/acme/subjects/count': count,
    'GET /console/api/admin/tenants/acme/clients/count': count,
    'GET /console/api/admin/tenants/acme/groups/count': count,
    'GET /console/api/admin/tenants/acme/roles/count': count,
    'GET /console/api/admin/tenants/acme/scopes/count': count,
  });
  for (const collection of ['subjects', 'clients', 'groups', 'roles', 'scopes'] as const) {
    expect(await readCount(fake.transport.gateway, 'acme', collection)).toMatchObject({
      ok: true,
      data: { count: 3, capped: false },
    });
  }
  expect(fake.calls.map((call) => call.path)).toEqual([
    '/console/api/admin/tenants/acme/subjects/count',
    '/console/api/admin/tenants/acme/clients/count',
    '/console/api/admin/tenants/acme/groups/count',
    '/console/api/admin/tenants/acme/roles/count',
    '/console/api/admin/tenants/acme/scopes/count',
  ]);
});

const KEY = {
  id: 'k1',
  status: 'active',
  kid: 'kid1',
  alg: 'ES256',
  created_at: '2026-09-01T00:00:00Z',
  not_after: null,
};

it('reads every signing key, following the cursor to the last page', async () => {
  const fake = fakeTransport({
    'GET /console/api/admin/tenants/acme/keys': inTurn(
      json({ items: [KEY], next: 'c1' }),
      json({ items: [{ ...KEY, id: 'k2', status: 'rotating' }] }),
    ),
  });
  const result = await readKeys(fake.transport.gateway, 'acme');
  expect(result).toMatchObject({ ok: true, data: [{ id: 'k1' }, { id: 'k2' }] });
  expect(fake.sent.map((sent) => sent.search.toString())).toEqual([
    'limit=200',
    'limit=200&cursor=c1',
  ]);
});

it('reads the five latest audit rows', async () => {
  const fake = fakeTransport({
    'GET /console/api/admin/tenants/acme/audit': json({ items: [] }),
  });
  expect(await readLatestAudit(fake.transport.gateway, 'acme')).toMatchObject({
    ok: true,
    data: [],
  });
  expect(fake.sent[0]?.search.toString()).toBe('limit=5');
});

it('gives up, and says so, on a key list whose cursor never ends', async () => {
  const fake = fakeTransport({
    'GET /console/api/admin/tenants/acme/keys': json({ items: [KEY], next: 'again' }),
  });
  const logged: string[] = [];
  const result = await readKeys(fake.transport.gateway, 'acme', (message) => {
    logged.push(message);
  });
  expect(result).toEqual({ ok: false, kind: 'defect' });
  expect(fake.calls).toHaveLength(10);
  expect(logged).toEqual(['console defect: GET keys of acme still had a next page after 10 pages']);
});
