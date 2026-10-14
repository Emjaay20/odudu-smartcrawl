import { json, type Answer, type Sent } from '#/testing/fakeTransport';
import { matchesName, underParent } from '#/testing/listFilters';
import { graceRoutes, ACME_ADMIN } from '#/testing/renderConsole';
import { ADMIN_ROLES, EVERY_TENANT_CAPABILITY, role } from '#/testing/roleAnswers';
export const R = `${ACME_ADMIN}/roles`;

export const AUDITOR = { ...role('r-aud', 'auditor'), description: 'Reads the books' };
export const READER = role('r-read', 'reader');
export const PORTAL_READER = role('r-portal', 'reader', 'portal');
export const ROLES = [AUDITOR, READER, PORTAL_READER, ...ADMIN_ROLES];

function listed(request: Sent) {
  return ROLES.filter(
    (each) =>
      underParent(request, 'client', 'tenant', each.client_id) && matchesName(request, each),
  );
}

// grace of acme, holding the capabilities given, among the roles above.
export function roleRoutes(
  capabilities: readonly string[] = EVERY_TENANT_CAPABILITY,
  extra: Record<string, Answer> = {},
): Record<string, Answer> {
  return graceRoutes(
    capabilities,
    {
      [`GET ${R}`]: (request) => json({ items: listed(request) })(request),
      [`GET ${R}/count`]: (request) =>
        json({ count: listed(request).length, capped: false })(request),
      ...Object.fromEntries(
        ROLES.flatMap((each) => [
          [`GET ${R}/${each.id}`, json(each, 200, { etag: `"${each.id}-1"` })],
          [`GET ${R}/${each.id}/composites`, json({ items: [] }, 200, { etag: `"${each.id}-c1"` })],
        ]),
      ),
      [`GET ${ACME_ADMIN}/audit`]: json({ items: [] }),
      [`GET ${ACME_ADMIN}/subjects`]: json({ items: [] }),
      [`GET ${ACME_ADMIN}/subjects/count`]: json({ count: 0, capped: false }),
      [`GET ${ACME_ADMIN}/subjects/s1/admin-capabilities`]: json({ items: [], complete: true }),
      [`GET ${ACME_ADMIN}/subjects/s1/groups`]: json({ items: [] }, 200, { etag: '"m0"' }),
    },
    extra,
  );
}
