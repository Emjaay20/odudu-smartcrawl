import { expect, it } from 'vitest';
import { findScope } from '#/features/scopes/adapter/scopes';
import { fakeTransport, json, problem } from '#/testing/fakeTransport';

const S = '/console/api/admin/tenants/acme/scopes';

function scope(id: string, name: string) {
  return {
    id,
    name,
    description: null,
    include_in_id_token: true,
    include_in_access_token: true,
    default_client_assignment: 'optional',
    consent_text: null,
    display_order: 0,
    builtin: false,
    created_at: '2026-09-28T08:41:53.858Z',
  };
}

it('finds a scope by its exact name among the ones that start with it, in one full page', async () => {
  const fake = fakeTransport({
    [`GET ${S}`]: json({ items: [scope('s1', 'orders:write'), scope('s2', 'orders')] }),
  });
  const gateway = fake.transport.gateway;
  expect(await findScope(gateway, 'acme', 'orders')).toMatchObject({
    ok: true,
    data: { id: 's2', name: 'orders' },
  });
  expect(fake.sent[0]?.search.toString()).toBe('name=orders&limit=200');
  expect(await findScope(gateway, 'acme', 'nobody')).toMatchObject({ ok: true, data: null });
});

it('passes a refusal through', async () => {
  const fake = fakeTransport({ [`GET ${S}`]: problem(403, 'about:blank', 'Forbidden') });
  expect(await findScope(fake.transport.gateway, 'acme', 'orders')).toMatchObject({
    ok: false,
    kind: 'problem',
  });
});
