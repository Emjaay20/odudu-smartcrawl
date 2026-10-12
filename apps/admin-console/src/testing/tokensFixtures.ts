import { json, type Answer } from '#/testing/fakeTransport';
import { GRACE, whoami } from '#/testing/renderConsole';
import { EVERY_TENANT_CAPABILITY } from '#/testing/subjectsFixtures';

export const A = '/console/api/admin/tenants/acme';
export const RT = `${A}/registration-tokens`;

export function token(id: string, uses: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    remaining_uses: uses,
    created_at: '2026-10-12T08:00:00.000Z',
    expires_at: '2026-10-12T20:00:00.000Z',
    ...extra,
  };
}

export const TOKEN_ONE = token('t-one', 1);
export const TOKEN_FEW = token('t-few', 5);

export const MINTED_SECRET = 'rt_9f3c0a1e7b2d44c1a5e6';

export const MINTED = {
  id: 't-new',
  token: MINTED_SECRET,
  remaining_uses: 3,
  expires_at: '2026-10-12T21:00:00.000Z',
};

// grace of acme holding the capabilities given, with two live tokens.
export function tokenRoutes(
  capabilities: readonly string[] = EVERY_TENANT_CAPABILITY,
  extra: Record<string, Answer> = {},
): Record<string, Answer> {
  return {
    'GET /console/api/session': json(GRACE),
    [`GET ${A}/whoami`]: whoami(capabilities),
    [`GET ${RT}`]: json({ items: [TOKEN_ONE, TOKEN_FEW] }),
    ...extra,
  };
}
