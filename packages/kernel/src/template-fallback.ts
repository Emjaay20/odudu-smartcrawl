import { type PageKind } from '#/page-kinds';

export const MAX_REPORTED_FALLBACKS = 1024;
const MAX_REASON_LENGTH = 200;

export interface TemplateFallback {
  scope: string;
  kind: PageKind;
  reason: string;
}

// A theme's template that no longer fills is replaced by the default on every
// render, so the log hears of it once per scope (a tenant, client and
// published version) and kind, not once per request. The set of what was
// heard holds at most `bound` entries and is emptied when full, so a flood
// of distinct scopes costs a repeated line, never memory.
export function createFallbackReporter(
  log: (entry: TemplateFallback) => void,
  bound = MAX_REPORTED_FALLBACKS,
): (scope: string) => (kind: PageKind, reason: string) => void {
  const heard = new Set<string>();
  return (scope) => (kind, reason) => {
    const key = `${scope}\u0000${kind}`;
    if (heard.has(key)) return;
    if (heard.size >= bound) heard.clear();
    heard.add(key);
    log({ scope, kind, reason: reason.replace(/\s+/gu, ' ').slice(0, MAX_REASON_LENGTH) });
  };
}
