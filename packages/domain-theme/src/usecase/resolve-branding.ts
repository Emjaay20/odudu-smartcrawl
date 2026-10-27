import {
  createFallbackReporter,
  MAX_CLIENT_ID_LENGTH,
  type BrandingResolver,
  type BrandingScope,
  type PageBranding,
  type TemplateFallback,
} from '@odudu/kernel';
import { type PublishedLayers } from '#/service/theme-body';
import { type BrandingCache } from '#/service/branding-cache';
import { buildBranding } from '#/service/build-branding';

// Concurrent misses for one key share a read; past this many distinct keys
// in flight a miss simply reads for itself.
export const MAX_BRANDING_READS_IN_FLIGHT = 256;
// What the log has already heard, emptied when full, so a flood of distinct
// scopes costs a repeated line, never memory.
export const MAX_LOGGED_BRANDING_PROBLEMS = 1024;
const MAX_ERROR_LENGTH = 200;

export interface BrandingProblem {
  scope: string;
  reason: string;
}

export interface ResolveBrandingDeps {
  readPublished(tenantId: string, oauthClientId: string | null): Promise<PublishedLayers>;
  // The origin pages are served from (ODUDU_PUBLIC_BASE_URL); none means no
  // page can be themed, since a theme's URLs are checked against it.
  origin: string | undefined;
  // Keyed by tenant and client, not by version: a render learns the current
  // version only by reading, so an entry stands until a publish in this
  // process drops it (`invalidateTenant`) or its ttl ends, which is the
  // longest another process can show a replaced theme.
  cache: BrandingCache<PageBranding | null>;
  log(problem: BrandingProblem): void;
  reportFallback(entry: TemplateFallback): void;
}

// Rough weight of an entry, so a few large themes cannot fill the cache.
function weigh(branding: PageBranding | null): number {
  if (branding === null) return 256;
  const templates = Object.values(branding.branding.templates).reduce(
    (total, template) => total + template.length,
    0,
  );
  return 2 * (templates + branding.branding.tokensCss.length) + 2048;
}

function describe(error: unknown): string {
  const text = error instanceof Error ? error.message : 'unknown error';
  return text.slice(0, MAX_ERROR_LENGTH).replace(/\s+/gu, ' ');
}

// What a page is rendered with for a tenant and, when it has one, a client:
// the client's published pieces over the tenant's over the default, from one
// statement on a miss and none on a hit. It never rejects: whatever goes
// wrong, the page gets the default theme and the log one line.
export function resolveBranding(deps: ResolveBrandingDeps): BrandingResolver {
  const report = createFallbackReporter((entry) => {
    deps.reportFallback(entry);
  });
  const heard = new Set<string>();
  const inflight = new Map<string, Promise<PageBranding | null>>();

  function note(scope: string, reason: string): void {
    const key = `${scope}\u0000${reason}`;
    if (heard.has(key)) return;
    if (heard.size >= MAX_LOGGED_BRANDING_PROBLEMS) heard.clear();
    heard.add(key);
    deps.log({ scope, reason });
  }

  async function fill(
    scope: BrandingScope,
    origin: string,
    key: string,
  ): Promise<PageBranding | null> {
    const generation = deps.cache.generation();
    let layers: PublishedLayers;
    try {
      layers = await deps.readPublished(scope.tenantId, scope.clientId);
    } catch (error) {
      deps.log({ scope: key, reason: `the theme could not be read: ${describe(error)}` });
      return null;
    }
    const built = buildBranding({
      tenantName: scope.tenantName,
      origin,
      layers: [
        ...(layers.client === null ? [] : [{ name: 'client' as const, layer: layers.client }]),
        ...(layers.tenant === null ? [] : [{ name: 'tenant' as const, layer: layers.tenant }]),
      ],
    });
    const label = `${key}:${built.version}`;
    for (const reason of built.problems) note(label, reason);
    for (const { kind, reason } of built.refused) report(label)(kind, reason);
    const value =
      built.branding === null
        ? null
        : { branding: built.branding, templateFallback: report(label) };
    deps.cache.set(key, scope.tenantId, value, weigh(value), generation);
    return value;
  }

  async function guarded(
    scope: BrandingScope,
    origin: string,
    key: string,
  ): Promise<PageBranding | null> {
    try {
      return await fill(scope, origin, key);
    } catch (error) {
      deps.log({ scope: key, reason: `the theme could not be resolved: ${describe(error)}` });
      return null;
    }
  }

  return (input) => {
    if (deps.origin === undefined) {
      note('config', 'ODUDU_PUBLIC_BASE_URL is not set, so pages are not themed');
      return Promise.resolve(null);
    }
    const clientId =
      input.clientId !== null &&
      input.clientId !== '' &&
      input.clientId.length <= MAX_CLIENT_ID_LENGTH
        ? input.clientId
        : null;
    const key = `${input.tenantId}:${clientId ?? ''}`;
    const held = deps.cache.get(key);
    if (held !== undefined) return Promise.resolve(held.value);
    const running = inflight.get(key);
    if (running !== undefined) return running;
    const started: Promise<PageBranding | null> = guarded(
      { ...input, clientId },
      deps.origin,
      key,
    ).finally(() => {
      if (inflight.get(key) === started) inflight.delete(key);
    });
    if (inflight.size < MAX_BRANDING_READS_IN_FLIGHT) inflight.set(key, started);
    return started;
  };
}
