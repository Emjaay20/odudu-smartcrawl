// Every cache key a read or an invalidation names for more than one hook.
// A hook builds its key here and a change elsewhere invalidates it from the
// same function, so the shape has one author.

export function listKey(tenant: string, ...resource: readonly string[]) {
  return ['list', tenant, ...resource] as const;
}

// One list read, from `cursor` onwards, under the list's own key.
export function pageKey(
  key: readonly unknown[],
  query: URLSearchParams,
  cursor: string | undefined,
) {
  return [...key, query.toString(), cursor ?? ''] as const;
}

export function countKey(tenant: string, ...resource: readonly string[]) {
  return ['count', tenant, ...resource] as const;
}

export function pickerKey(tenant: string, resource: string) {
  return ['picker', tenant, resource] as const;
}

// The kind of a record entry, which a change reads again by its path prefix.
export const RECORD_KIND = 'record';

export function recordKey(tenant: string, record: string) {
  return [RECORD_KIND, tenant, record] as const;
}

// The kind of a read of one group, which a change to groups reads again.
export const GROUP_KIND = 'group';

export function groupKey(tenant: string, id: string | null) {
  return [GROUP_KIND, tenant, id] as const;
}

export function holdersKey(tenant: string, ...rest: readonly string[]) {
  return ['holders', tenant, ...rest] as const;
}

export function heldCapabilitiesKey(tenant: string, ...subject: readonly string[]) {
  return ['held-capabilities', tenant, ...subject] as const;
}

export function membershipsKey(tenant: string, subject: string) {
  return ['memberships', tenant, subject] as const;
}

export function scopeClientsKey(tenant: string, ...scope: readonly string[]) {
  return ['scope-clients', tenant, ...scope] as const;
}

export function overviewKey(tenant: string, ...read: readonly string[]) {
  return ['overview', tenant, ...read] as const;
}
