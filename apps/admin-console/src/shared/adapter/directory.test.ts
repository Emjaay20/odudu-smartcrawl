import { expect, it } from 'vitest';
import { readSubjectCount, readSubjectPage } from '#/shared/adapter/directory';
import { fakeTransport, json } from '#/testing/fakeTransport';

const T = '/console/api/admin/tenants/acme';
const SUBJECT = {
  id: '01a0e72d-7fc7-7950-a1e7-1d079588f8b4',
  type: 'user',
  username: 'grace',
  email: null,
  enabled: true,
  created_at: '2026-09-28T08:41:53.858Z',
};

it("lists the tenant's administrators as the subjects holding tenant-admin", async () => {
  const fake = fakeTransport({ [`GET ${T}/subjects`]: json({ items: [SUBJECT] }) });
  const query = new URLSearchParams({ capability: 'tenant-admin' });
  expect(await readSubjectPage(fake.transport.gateway, 'acme', query)).toMatchObject({
    ok: true,
    data: { items: [SUBJECT] },
  });
  expect(fake.sent[0]?.search.get('capability')).toBe('tenant-admin');
});

it('counts them with the same query', async () => {
  const fake = fakeTransport({ [`GET ${T}/subjects/count`]: json({ count: 2, capped: false }) });
  const query = new URLSearchParams({ capability: 'tenant-admin' });
  expect(await readSubjectCount(fake.transport.gateway, 'acme', query)).toMatchObject({
    ok: true,
    data: { count: 2, capped: false },
  });
});
