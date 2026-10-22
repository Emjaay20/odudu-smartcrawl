import { CLIENT_SCOPE_LIMIT, defaultScopeLimitMessage, SCOPE_LIMIT } from '@odudu/contracts/admin';
import { type TenantScopedDatabase } from '@odudu/db';
import {
  clientScopeRepository,
  type ClientScopeAssignment,
  type NewClientScope,
} from '#/repository/client-scopes';

interface DefaultScope {
  scope: Omit<NewClientScope, 'tenantId'>;
  // 'default' pre-approves a scope the way P1 always has; 'optional' is
  // what lets P3's consent screen tell a pre-approved scope from one the
  // user must see and approve separately. `offline_access` is the one
  // scope here where that distinction matters — a credential a logout
  // cannot end is not something to pre-approve silently.
  assignment: ClientScopeAssignment;
}

// A scope is a promise about claims, and discovery advertises every scope a
// tenant defines. So a scope is seeded here only once a claim mapper can
// answer for it (packages/protocol-oidc/src/service/claims.ts). `roles`/
// `groups` default `includeInIdToken` false and `includeInAccessToken`
// true; the other five are the reverse — identity data for the browser,
// not a resource server named in `aud`. `offline_access` is the exception:
// it maps no claims, because it asks for a grant shape, not data — see
// docs/protocols/oidc-backchannel.md §2.7.
const DEFAULT_SCOPES: readonly DefaultScope[] = [
  { scope: { name: 'openid', includeInAccessToken: false }, assignment: 'default' },
  { scope: { name: 'profile', includeInAccessToken: false }, assignment: 'default' },
  { scope: { name: 'email', includeInAccessToken: false }, assignment: 'default' },
  { scope: { name: 'address', includeInAccessToken: false }, assignment: 'default' },
  { scope: { name: 'phone', includeInAccessToken: false }, assignment: 'default' },
  { scope: { name: 'roles', includeInIdToken: false }, assignment: 'default' },
  { scope: { name: 'groups', includeInIdToken: false }, assignment: 'default' },
  {
    scope: { name: 'offline_access', includeInAccessToken: false, includeInIdToken: false },
    assignment: 'optional',
  },
];

// Published so a document asserting what a freshly seeded tenant advertises
// can be checked against the list that actually seeds it (tests/docs/).
export const TENANT_DEFAULT_SCOPE_NAMES: readonly string[] = DEFAULT_SCOPES.map(
  (defaultScope) => defaultScope.scope.name,
);

async function createDefaultScope(
  tx: TenantScopedDatabase,
  tenantId: string,
  { scope, assignment }: DefaultScope,
): Promise<void> {
  await clientScopeRepository(tx).create({
    tenantId,
    ...scope,
    defaultClientAssignment: assignment,
  });
}

// Called once per tenant, at the point the tenant itself is created — the
// bootstrap seed command and every test fixture that stands up a tenant call
// this so that a tenant is never left without a scope vocabulary.
export async function provisionTenantDefaults(
  tx: TenantScopedDatabase,
  tenantId: string,
): Promise<void> {
  for (const defaultScope of DEFAULT_SCOPES) {
    await createDefaultScope(tx, tenantId, defaultScope);
  }
}

const BUILTIN_NAMES: ReadonlySet<string> = new Set(TENANT_DEFAULT_SCOPE_NAMES);

// Decided by the name alone: a scope an administrator created under a built-in
// name is built in too.
export function isBuiltinScopeName(name: string): boolean {
  return BUILTIN_NAMES.has(name);
}

// The built-in scopes this tenant no longer has, in provisioning order. One
// query over the name index, whatever the tenant holds.
export async function missingBuiltinScopeNames(tx: TenantScopedDatabase): Promise<string[]> {
  const present = new Set(
    (await clientScopeRepository(tx).byNames(TENANT_DEFAULT_SCOPE_NAMES)).map(({ name }) => name),
  );
  return TENANT_DEFAULT_SCOPE_NAMES.filter((name) => !present.has(name));
}

export type RestoreBuiltinScopesOutcome =
  | { kind: 'restored'; created: readonly string[] }
  | { kind: 'scope_limit' }
  | { kind: 'default_scope_limit'; message: string };

// Creates each missing built-in as provisioning created it, and touches
// nothing that exists, edited or not. A scope the cascade took leaves no
// client assignment or role mapping behind, and none is recreated: only the
// row, with the mark that assigns it to clients created afterwards. Run in
// the caller's transaction, so a refusal leaves no partial restore.
export async function restoreBuiltinScopes(
  tx: TenantScopedDatabase,
  tenantId: string,
): Promise<RestoreBuiltinScopesOutcome> {
  const repository = clientScopeRepository(tx);
  await repository.lockCreation(tenantId);
  const missing = await missingBuiltinScopeNames(tx);
  if (missing.length === 0) return { kind: 'restored', created: [] };
  if ((await repository.countUpTo(SCOPE_LIMIT)) + missing.length > SCOPE_LIMIT) {
    return { kind: 'scope_limit' };
  }
  // Every built-in is marked for new clients, so the whole set must fit under
  // that ceiling before the first row is written: nothing is committed on a refusal.
  const marked = await repository.countDefaultsUpTo(tenantId, CLIENT_SCOPE_LIMIT);
  if (marked + missing.length > CLIENT_SCOPE_LIMIT) {
    return { kind: 'default_scope_limit', message: defaultScopeLimitMessage() };
  }
  for (const defaultScope of DEFAULT_SCOPES) {
    if (missing.includes(defaultScope.scope.name)) {
      await createDefaultScope(tx, tenantId, defaultScope);
    }
  }
  return { kind: 'restored', created: missing };
}

// A scope reaches a token only when the tenant defines it *and* the client is
// assigned it, so a newly provisioned client starts with the scopes its
// tenant marks with a `defaultClientAssignment` and nothing else — the
// standard vocabulary above until an administrator changes the marks. The
// assignment kind travels with each scope: `resolveScope` grants an
// `'optional'` scope exactly like a `'default'` one, but the consent screen
// tells them apart.
export async function provisionClientDefaults(
  tx: TenantScopedDatabase,
  clientId: string,
): Promise<void> {
  const repository = clientScopeRepository(tx);
  for (const scope of await repository.allForTenant()) {
    if (scope.defaultClientAssignment !== null) {
      await repository.assign(clientId, scope.id, scope.defaultClientAssignment);
    }
  }
}
