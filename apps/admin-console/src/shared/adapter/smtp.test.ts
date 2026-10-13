import { expect, it } from 'vitest';
import { readSmtp } from '#/shared/adapter/smtp';
import { fakeTransport, json } from '#/testing/fakeTransport';

it('reads the SMTP relay of a tenant', async () => {
  const fake = fakeTransport({
    'GET /console/api/admin/tenants/acme/smtp': json({
      configured: false,
      host: null,
      port: null,
      from_address: null,
      username: null,
      password_set: false,
      starttls: null,
      effective: 'none',
    }),
  });
  expect(await readSmtp(fake.transport.gateway, 'acme')).toMatchObject({
    ok: true,
    data: { effective: 'none' },
  });
});
