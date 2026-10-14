import { json, type Answer, type Sent } from '#/testing/fakeTransport';
import { ACME_ADMIN } from '#/testing/tenantPaths';
import { graceRoutes } from '#/testing/renderConsole';
import { group, record } from '#/testing/groupAnswers';
import { matchesName, underParent } from '#/testing/listFilters';
import { AUDITOR, PORTAL_READER } from '#/testing/rolesFixtures';
import { ADMIN_ROLES, EVERY_TENANT_CAPABILITY } from '#/testing/roleAnswers';
export const G = `${ACME_ADMIN}/groups`;

// A role as the group's roles answer carries it, with what it reaches.
export function mapped(each: {
  id: string;
  name: string;
  client_id: string | null;
  client_key: string | null;
  admin_reach?: readonly string[];
}) {
  return {
    id: each.id,
    name: each.name,
    client_id: each.client_id,
    client_key: each.client_key,
    admin_reach: each.admin_reach ?? [],
  };
}

export const ENG = group('g-eng', '/eng', null, { description: 'Builds the product' });
export const PLATFORM = group('g-plat', '/eng/platform', 'g-eng');
export const FINANCE = group('g-fin', '/finance');
export const GROUPS = [ENG, PLATFORM, FINANCE];

// The built-in admin client's role of this name.
export function adminRole(name: string) {
  const found = ADMIN_ROLES.find((each) => each.name === name);
  if (found === undefined) throw new Error(`no admin role ${name}`);
  return found;
}

function listed(request: Sent) {
  return GROUPS.filter(
    (each) => underParent(request, 'parent', 'root', each.parent_id) && matchesName(request, each),
  );
}

// grace of acme, holding the capabilities given, among /eng, /eng/platform
// and /finance.
export function groupRoutes(
  capabilities: readonly string[] = EVERY_TENANT_CAPABILITY,
  extra: Record<string, Answer> = {},
): Record<string, Answer> {
  return graceRoutes(
    capabilities,
    {
      [`GET ${G}`]: (request) => json({ items: listed(request) })(request),
      [`GET ${G}/count`]: (request) =>
        json({ count: listed(request).length, capped: false })(request),
      ...Object.fromEntries(
        GROUPS.flatMap((each) => [
          [`GET ${G}/${each.id}`, json(record(each), 200, { etag: `"${each.id}-1"` })],
          [`GET ${G}/${each.id}/roles`, json({ items: [] }, 200, { etag: `"${each.id}-r1"` })],
        ]),
      ),
      [`GET ${ACME_ADMIN}/roles`]: json({ items: [AUDITOR, PORTAL_READER, ...ADMIN_ROLES] }),
      ...Object.fromEntries(
        [AUDITOR, PORTAL_READER, ...ADMIN_ROLES].map((each) => [
          `GET ${ACME_ADMIN}/roles/${each.id}`,
          json(each, 200, { etag: `"${each.id}-1"` }),
        ]),
      ),
      [`GET ${ACME_ADMIN}/audit`]: json({ items: [] }),
      [`GET ${ACME_ADMIN}/subjects`]: json({ items: [] }),
      [`GET ${ACME_ADMIN}/subjects/count`]: json({ count: 0, capped: false }),
      [`GET ${ACME_ADMIN}/subjects/s1/groups`]: json({ items: [] }, 200, { etag: '"m0"' }),
    },
    extra,
  );
}
