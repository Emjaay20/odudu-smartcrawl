// A path a program calls, however a browser got there: it is answered with
// a problem document and never a page. Compared case-insensitively and again
// after one percent-decoding, so a differently spelled path cannot slip past.
const API_PREFIXES = ['/admin', '/console/api', '/health', '/instrument', '/.well-known'];

// Under /tenants/:tenant, the protocol endpoints and discovery are called by
// clients; the browser flows (login-actions) are the rest.
const TENANT_API_SEGMENTS = new Set(['protocol', '.well-known']);

function pathOf(url: string): string {
  const end = url.search(/[?#]/u);
  return end === -1 ? url : url.slice(0, end);
}

function decoded(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function underPrefix(path: string, prefix: string): boolean {
  if (prefix === '/health') return path.startsWith(prefix);
  return path === prefix || path.startsWith(`${prefix}/`);
}

function isApi(path: string): boolean {
  const lower = path.toLowerCase();
  if (API_PREFIXES.some((prefix) => underPrefix(lower, prefix))) return true;
  const [, first, , third] = lower.split('/');
  return first === 'tenants' && third !== undefined && TENANT_API_SEGMENTS.has(third);
}

export function isApiPath(url: string): boolean {
  const path = pathOf(url);
  return isApi(path) || isApi(decoded(path));
}

// The quality an Accept header gives one media type written exactly, or null
// when it does not name it. A malformed q is no preference at all.
function quality(accept: string, type: string): number | null {
  let best: number | null = null;
  for (const entry of accept.split(',')) {
    const [name = '', ...parameters] = entry.split(';').map((part) => part.trim());
    if (name.toLowerCase() !== type) continue;
    const q = parameters.find((parameter) => /^q\s*=/iu.test(parameter));
    const value = q === undefined ? 1 : Number(q.slice(q.indexOf('=') + 1));
    if (Number.isNaN(value)) continue;
    best = Math.max(best ?? 0, value);
  }
  return best;
}

const JSON_TYPES = ['application/json', 'application/problem+json'];

// A browser navigation: a GET or HEAD whose Accept names text/html outright
// and ranks it at least as high as any JSON type it also names. `*/*` and
// `text/*` do not count, so a program that accepts anything still gets JSON.
// A browser's Accept is a few hundred bytes; a longer one is not a navigation,
// and is refused before any of it is read.
const MAX_ACCEPT_LENGTH = 2048;

export function prefersHtml(accept: unknown): boolean {
  if (typeof accept !== 'string' || accept.length > MAX_ACCEPT_LENGTH) return false;
  const html = quality(accept, 'text/html');
  if (html === null || html <= 0) return false;
  return JSON_TYPES.every((type) => html >= (quality(accept, type) ?? 0));
}

export function wantsHtmlPage(method: string, url: string, accept: unknown): boolean {
  if (method !== 'GET' && method !== 'HEAD') return false;
  return !isApiPath(url) && prefersHtml(accept);
}
