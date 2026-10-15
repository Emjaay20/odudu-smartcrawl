import { expect, it } from 'vitest';
import { assignScope, unassignScope } from '#/shared/adapter/scopeAssignment';
import { fakeTransport, json } from '#/testing/fakeTransport';

const ROUTE = '/console/api/admin/tenants/acme/scopes/s%201/clients/c1';

it('assigns a scope to a client with the assignment as the body', async () => {
  const fake = fakeTransport({
    [`PUT ${ROUTE}`]: json({ client_id: 'c1', scopes: [] }),
  });
  const result = await assignScope(fake.transport.gateway, 'acme', 's 1', 'c1', 'optional');
  expect(result.ok).toBe(true);
  expect(fake.sent[0]?.body).toEqual({ assignment: 'optional' });
});

it('unassigns it with a DELETE to the same route', async () => {
  const fake = fakeTransport({ [`DELETE ${ROUTE}`]: () => new Response(null, { status: 204 }) });
  expect(await unassignScope(fake.transport.gateway, 'acme', 's 1', 'c1')).toMatchObject({
    ok: true,
  });
});
