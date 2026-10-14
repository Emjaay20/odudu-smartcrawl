import { json, type Answer } from '#/testing/fakeTransport';
import { graceRoutes, ACME_ADMIN } from '#/testing/renderConsole';
import { EVERY_TENANT_CAPABILITY } from '#/testing/roleAnswers';
export const KEYS = `${ACME_ADMIN}/keys`;

export function signingKey(id: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    status,
    kid: `kid-${id}`,
    alg: 'ES256',
    created_at: '2026-10-01T00:00:00.000Z',
    not_after: null,
    ...extra,
  };
}

export const ACTIVE_KEY = signingKey('k-active', 'active', {
  created_at: '2026-09-01T00:00:00.000Z',
});
// Published long before any test's clock, so ready to promote.
export const READY_KEY = signingKey('k-ready', 'rotating', {
  created_at: '2026-10-01T00:00:00.000Z',
});
export const YOUNG_KEY = signingKey('k-young', 'rotating', {
  created_at: new Date().toISOString(),
});
export const RETIRED_KEY = signingKey('k-retired', 'retired', {
  created_at: '2026-08-01T00:00:00.000Z',
});

// What the lane's own `status` query returns.
export function lanes(
  keys: readonly { status: string }[],
  extra: Record<string, unknown> = {},
): Answer {
  return (request) => {
    const status = request.search.get('status');
    return json({ items: keys.filter((key) => key.status === status), ...extra })(request);
  };
}

// grace of acme holding the capabilities given, with one key in each lane.
export function keyRoutes(
  capabilities: readonly string[] = EVERY_TENANT_CAPABILITY,
  extra: Record<string, Answer> = {},
  keys: readonly { status: string }[] = [READY_KEY, ACTIVE_KEY, RETIRED_KEY],
): Record<string, Answer> {
  return graceRoutes(
    capabilities,
    {
      [`GET ${KEYS}`]: lanes(keys),
    },
    extra,
  );
}
