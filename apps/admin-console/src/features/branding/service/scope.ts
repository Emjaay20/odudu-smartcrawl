// Whose theme a call is about: the tenant's own, or one client's.
export type ThemeScope = { kind: 'tenant' } | { kind: 'client'; id: string };

export const TENANT_SCOPE: ThemeScope = { kind: 'tenant' };

// Where the scope's theme sits under the tenant in the admin API.
export function themeParts(scope: ThemeScope): readonly string[] {
  return scope.kind === 'tenant' ? ['theme'] : ['clients', scope.id, 'theme'];
}

// The record the console caches the theme under, and its sections' drafts.
export function themeRecord(scope: ThemeScope): string {
  return themeParts(scope).join('/');
}

export function scopeKeyPart(scope: ThemeScope): string {
  return scope.kind === 'tenant' ? 'tenant' : `client:${scope.id}`;
}

// Images belong to the tenant, a client's theme naming the tenant's.
export const ASSET_PARTS: readonly string[] = ['theme', 'assets'];

// The tag a theme with no draft is held under: the server sends none, and a
// first save must then carry no If-Match at all.
export const NO_DRAFT_TAG = '"no-draft"';

export function ifMatchOf(tag: string): string | undefined {
  return tag === NO_DRAFT_TAG ? undefined : tag;
}

export function tagOf(etag: string | null): string {
  return etag ?? NO_DRAFT_TAG;
}
