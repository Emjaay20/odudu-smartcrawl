// ADR 0041's volume is 10,000 tenants with 10,000 clients each, so the cache
// is bounded by entries and by weight, never by the number of scopes: at
// most `maxEntries` entries and `maxBytes` of template text, least recently
// used first out, each also gone after `ttlMs`. A scope with no theme is an
// entry too, so a render of it costs no query; its key is a tenant id and a
// client id of at most 255 characters, and the bound above is what stops
// distinct keys growing memory.
export const brandingCache = {
  maxEntries: 5000,
  ttlMs: 30_000,
  maxBytes: 32 * 1024 * 1024,
} as const;

export interface BrandingCacheOptions {
  now: () => number;
  maxEntries?: number;
  ttlMs?: number;
  maxBytes?: number;
}

interface Entry<V> {
  tenantId: string;
  value: V;
  bytes: number;
  expiresAt: number;
}

export interface BrandingCache<V> {
  // `{ value }` for a live entry, whatever the value (null included).
  get(key: string): { value: V } | undefined;
  // Ignored when `generation` is not the current one: an entry filled from a
  // read that began before an invalidation is the stale one.
  set(key: string, tenantId: string, value: V, bytes: number, generation: number): void;
  // Drops every entry of the tenant: the hook a publish, restore or reset
  // calls so this process shows the change at once.
  invalidateTenant(tenantId: string): void;
  generation(): number;
  size(): number;
}

// A Map keeps insertion order, so re-inserting on a hit keeps the oldest
// entry first.
export function createBrandingCache<V>(options: BrandingCacheOptions): BrandingCache<V> {
  const maxEntries = options.maxEntries ?? brandingCache.maxEntries;
  const ttlMs = options.ttlMs ?? brandingCache.ttlMs;
  const maxBytes = options.maxBytes ?? brandingCache.maxBytes;
  const entries = new Map<string, Entry<V>>();
  let weight = 0;
  let generation = 0;

  function drop(key: string, entry: Entry<V>): void {
    entries.delete(key);
    weight -= entry.bytes;
  }

  return {
    get(key) {
      const entry = entries.get(key);
      if (entry === undefined) return undefined;
      if (entry.expiresAt <= options.now()) {
        drop(key, entry);
        return undefined;
      }
      entries.delete(key);
      entries.set(key, entry);
      return { value: entry.value };
    },
    set(key, tenantId, value, bytes, at) {
      if (at !== generation || bytes > maxBytes) return;
      const held = entries.get(key);
      if (held !== undefined) drop(key, held);
      entries.set(key, { tenantId, value, bytes, expiresAt: options.now() + ttlMs });
      weight += bytes;
      for (const [oldest, entry] of entries) {
        if (entries.size <= maxEntries && weight <= maxBytes) break;
        drop(oldest, entry);
      }
    },
    invalidateTenant(tenantId) {
      generation += 1;
      for (const [key, entry] of entries) {
        if (entry.tenantId === tenantId) drop(key, entry);
      }
    },
    generation: () => generation,
    size: () => entries.size,
  };
}
