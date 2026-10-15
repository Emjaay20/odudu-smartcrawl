import { expect, it } from 'vitest';
import { readTenantSettings } from '#/shared/adapter/tenantSettings';
import { fakeTransport, json } from '#/testing/fakeTransport';

it('reads the settings of a tenant', async () => {
  const fake = fakeTransport({
    'GET /console/api/admin/tenants/acme/settings': json({ verify_email: true, max_clients: 200 }),
  });
  expect(await readTenantSettings(fake.transport.gateway, 'acme')).toMatchObject({
    ok: true,
    data: { verify_email: true, max_clients: 200 },
  });
});
