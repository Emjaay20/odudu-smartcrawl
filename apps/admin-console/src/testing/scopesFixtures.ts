import { json, type Answer, type Sent } from '#/testing/fakeTransport.ts';
import { CLIENTS } from '#/testing/clientsFixtures.ts';
import { GRACE, whoami } from '#/testing/renderConsole.tsx';
import { ROLES } from '#/testing/rolesFixtures.ts';
import { EVERY_TENANT_CAPABILITY } from '#/testing/subjectsFixtures.ts';

export const A = '/console/api/admin/tenants/acme';
export const SC = `${A}/scopes`;

export interface ScopeAnswer {
  id: string;
  name: string;
  description: string | null;
  include_in_id_token: boolean;
  include_in_access_token: boolean;
  default_client_assignment: 'default' | 'optional' | null;
  consent_text: string | null;
  display_order: number;
  created_at: string;
}

export function scope(id: string, name: string, extra: Partial<ScopeAnswer> = {}): ScopeAnswer {
  return {
    id,
    name,
    description: null,
    include_in_id_token: false,
    include_in_access_token: true,
    default_client_assignment: null,
    consent_text: null,
    display_order: 0,
    created_at: '2026-09-28T08:41:53.858Z',
    ...extra,
  };
}

export const OPENID = scope('s-openid', 'openid', { include_in_id_token: true });
export const BILLING_SCOPE = scope('s-bill', 'billing', { description: 'Invoices' });
export const REPORTS = scope('s-rep', 'reports:read');
export const SCOPES = [OPENID, BILLING_SCOPE, REPORTS];

// The roles a scope maps, as its own read answers them: with what each reaches, no description.
export const MAPPED = {
  id: 'r-aud',
  name: 'auditor',
  client_id: null,
  client_key: null,
  admin_reach: [],
};

function listed(request: Sent) {
  const name = request.search.get('name');
  return SCOPES.filter((each) => name === null || each.name.startsWith(name.toLowerCase()));
}

function rolesListed(request: Sent) {
  const name = request.search.get('name');
  return ROLES.filter((each) => name === null || each.name.startsWith(name.toLowerCase()));
}

// The clients that carry a scope, as the scope's own list answers them.
export function carrier(
  id: string,
  clientId: string,
  name: string,
  assignment: 'default' | 'optional' = 'default',
) {
  return { id, client_id: clientId, name, assignment };
}

export const BILLING_CARRIES = carrier('c-bill', 'billing', 'Billing');

// grace of acme, holding the capabilities given, among three scopes: billing
// maps the auditor role, binds no mapper, and is carried by the billing client.
export function scopeRoutes(
  capabilities: readonly string[] = EVERY_TENANT_CAPABILITY,
  extra: Record<string, Answer> = {},
): Record<string, Answer> {
  return {
    'GET /console/api/session': json(GRACE),
    [`GET ${A}/whoami`]: whoami(capabilities),
    [`GET ${SC}`]: (request) => json({ items: listed(request) })(request),
    [`GET ${SC}/count`]: (request) =>
      json({ count: listed(request).length, capped: false })(request),
    ...Object.fromEntries(
      SCOPES.flatMap((each) => [
        [`GET ${SC}/${each.id}`, json(each, 200, { etag: `"${each.id}-1"` })],
        [`GET ${SC}/${each.id}/roles`, json({ items: [] }, 200, { etag: `"${each.id}-r1"` })],
        [
          `GET ${SC}/${each.id}/mappers`,
          json({ available: ['email', 'groups'], bound: [], declared: ['email'] }, 200, {
            etag: `"${each.id}-m1"`,
          }),
        ],
        [`GET ${SC}/${each.id}/clients`, json({ items: [] })],
      ]),
    ),
    [`GET ${SC}/s-bill/roles`]: json({ items: [MAPPED] }, 200, { etag: '"s-bill-r1"' }),
    [`GET ${SC}/s-bill/clients`]: json({ items: [BILLING_CARRIES] }),
    [`GET ${A}/roles`]: (request) => json({ items: rolesListed(request) })(request),
    [`GET ${A}/clients`]: (request) =>
      json({
        items: CLIENTS.filter(
          (each) =>
            request.search.get('name') === null ||
            each.name.toLowerCase().startsWith((request.search.get('name') ?? '').toLowerCase()),
        ),
      })(request),
    [`GET ${A}/audit`]: json({ items: [] }),
    ...extra,
  };
}
