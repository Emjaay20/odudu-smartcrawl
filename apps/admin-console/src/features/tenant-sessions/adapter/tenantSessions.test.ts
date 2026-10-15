import { expect, it } from 'vitest';
import {
  endTenantSessions,
  readTenantSessionPage,
} from '#/features/tenant-sessions/adapter/tenantSessions';
import { fakeTransport, json } from '#/testing/fakeTransport';

const SESSION = {
  id: '01a0e72d-7fc7-7950-a1e7-1d079588f8b4',
  subject_id: '01a0e72d-7fc7-7950-a1e7-1d079588f8b5',
  username: 'ada',
  created_at: '2026-09-28T08:41:53.858Z',
  last_active_at: '2026-09-28T09:41:53.858Z',
  remembered: false,
  client_ids: ['odudu-admin'],
};

it('reads one page of the tenant’s sessions with the cursor it is given', async () => {
  const fake = fakeTransport({
    'GET /console/api/admin/tenants/acme/sessions': json({ items: [SESSION], next: 'c2' }),
  });
  const query = new URLSearchParams({ cursor: 'c1' });
  expect(await readTenantSessionPage(fake.transport.gateway, 'acme', query)).toMatchObject({
    ok: true,
    data: { items: [SESSION], next: 'c2' },
  });
  expect(fake.sent.map((sent) => sent.search.toString())).toEqual(['cursor=c1']);
});

it('refuses an answer that names no subject', async () => {
  const bare = { ...SESSION, subject_id: undefined };
  const fake = fakeTransport({
    'GET /console/api/admin/tenants/acme/sessions': json({ items: [bare] }),
  });
  expect(
    await readTenantSessionPage(fake.transport.gateway, 'acme', new URLSearchParams()),
  ).toMatchObject({ ok: false, kind: 'schema' });
});

it('ends every session in the tenant and reads the three counts it answers with', async () => {
  const fake = fakeTransport({
    'DELETE /console/api/admin/tenants/acme/sessions': json({
      ended: 3,
      remaining: 1,
      beyond_ceiling: 2,
    }),
  });
  expect(await endTenantSessions(fake.transport.gateway, 'acme')).toMatchObject({
    ok: true,
    data: { ended: 3, remaining: 1, beyond_ceiling: 2 },
  });
  expect(fake.sent.map((sent) => sent.method)).toEqual(['DELETE']);
});
