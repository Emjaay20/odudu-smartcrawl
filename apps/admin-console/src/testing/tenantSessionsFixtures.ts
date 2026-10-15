import { json, type Answer } from '#/testing/fakeTransport';
import { ACME_ADMIN } from '#/testing/tenantPaths';
import { graceRoutes } from '#/testing/renderConsole';
import { EVERY_TENANT_CAPABILITY } from '#/testing/roleAnswers';

export const SESSIONS = `${ACME_ADMIN}/sessions`;

export function session(id: string, username: string | null, extra: Record<string, unknown> = {}) {
  return {
    id,
    subject_id: `sub-${id}`,
    username,
    created_at: '2026-10-12T08:00:00.000Z',
    last_active_at: '2026-10-12T09:30:00.000Z',
    remembered: false,
    client_ids: ['odudu-admin'],
    ...extra,
  };
}

export const SESSION_ADA = session('s-ada', 'ada');
export const SESSION_NAMELESS = session('s-bot', null, {
  remembered: true,
  client_ids: [],
});

// grace of acme holding the capabilities given, with two live sessions.
export function sessionRoutes(
  capabilities: readonly string[] = EVERY_TENANT_CAPABILITY,
  extra: Record<string, Answer> = {},
): Record<string, Answer> {
  return graceRoutes(
    capabilities,
    { [`GET ${SESSIONS}`]: json({ items: [SESSION_ADA, SESSION_NAMELESS] }) },
    extra,
  );
}
