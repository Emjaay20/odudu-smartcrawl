import { expect, it } from 'vitest';
import { settingsSave } from '#/features/settings/repository/settingsSave';
import { fakeTransport, json } from '#/testing/fakeTransport';
import { ACME_ADMIN } from '#/testing/tenantPaths';

const ST = `${ACME_ADMIN}/settings`;

it('amends only what changed, on the ETag the settings were read with', async () => {
  const { transport, sent } = fakeTransport({
    [`PATCH ${ST}`]: json({ verify_email: true }, 200, { etag: '"s2"' }),
  });
  const result = await settingsSave('acme')(transport.gateway, {
    changes: { verify_email: true, audit_event_types: ['admin_mutation', 'token'] },
    values: { verify_email: true, login_with_email: false },
    ifMatch: '"s1"',
  });
  expect(result).toMatchObject({ ok: true, etag: '"s2"' });
  expect(sent[0]).toMatchObject({
    method: 'PATCH',
    ifMatch: '"s1"',
    body: { verify_email: true, audit_event_types: ['admin_mutation', 'token'] },
  });
});

it('sends a number that was cleared as nothing at all', async () => {
  const { transport, sent } = fakeTransport({ [`PATCH ${ST}`]: json({}, 200, { etag: '"s2"' }) });
  await settingsSave('acme')(transport.gateway, {
    changes: { password_min_length: Number.NaN },
    values: { password_min_length: Number.NaN },
    ifMatch: '"s1"',
  });
  expect(sent[0]?.body).toEqual({});
});
