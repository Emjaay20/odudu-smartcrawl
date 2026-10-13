// Every cache key a read or an invalidation names for more than one hook.
// A hook builds its key here and a change elsewhere invalidates it from the
// same function, so the shape has one author.

export function listKey(tenant: string, ...resource: readonly string[]) {
  return ['list', tenant, ...resource] as const;
}

export function countKey(tenant: string, ...resource: readonly string[]) {
  return ['count', tenant, ...resource] as const;
}

export function pickerKey(tenant: string, resource: string) {
  return ['picker', tenant, resource] as const;
}

export function recordKey(tenant: string, record: string) {
  return ['record', tenant, record] as const;
}

export function holdersKey(tenant: string, ...rest: readonly string[]) {
  return ['holders', tenant, ...rest] as const;
}

export function heldCapabilitiesKey(tenant: string, ...subject: readonly string[]) {
  return ['held-capabilities', tenant, ...subject] as const;
}

export function scopeClientsKey(tenant: string, ...scope: readonly string[]) {
  return ['scope-clients', tenant, ...scope] as const;
}

export function overviewKey(tenant: string, ...read: readonly string[]) {
  return ['overview', tenant, ...read] as const;
}
