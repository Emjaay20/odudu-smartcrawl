// Turns what a console request carries into text that two builds of the
// console produce identically: ids, per-run names, timestamps and secrets are
// replaced by placeholders, and everything that is a decision is kept.

const RUN_ID = /e2e-[0-9a-z]{6,10}|rp-[0-9a-f]{8}/gu;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/giu;
const TIMESTAMP = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?/gu;
const LONG_NUMBER = /\d{10,}/gu;
const LOCAL_PORT = /(localhost|127\.0\.0\.1):\d+/gu;
const TOKEN = /[A-Za-z0-9_-]{22,}/gu;
const CURSOR_KEYS = new Set(['after', 'cursor', 'before', 'page_token']);
const SECRET_KEY =
  /password|secret|token|passcode|otp|credential|private|assertion|recovery|code/iu;
const WORD = /^[A-Za-z0-9:_-]{1,24}$/u;
const NAMED_HEADERS = new Set([
  'if-unmodified-since',
  'if-modified-since',
  'idempotency-key',
  'prefer',
  'range',
  'authorization',
]);
const LONG_TEXT = 60;

// A long run of letters of one case is a name (the layout tests seed one);
// digits or both cases together are what a generated value looks like.
function looksGenerated(text: string): boolean {
  return /\d/u.test(text) || (/[a-z]/u.test(text) && /[A-Z]/u.test(text));
}

export function normaliseText(text: string): string {
  return text
    .replace(RUN_ID, (found) => (found.startsWith('rp-') ? 'rp-RUN' : 'e2e-RUN'))
    .replace(LOCAL_PORT, '$1:PORT')
    .replace(UUID, ':uuid')
    .replace(TIMESTAMP, ':ts')
    .replace(LONG_NUMBER, ':num')
    .replace(TOKEN, (found) => (looksGenerated(found) ? ':token' : found));
}

function decoded(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function pathTemplate(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => normaliseText(decoded(segment)))
    .join('/');
}

export function queryShape(search: string): string {
  const entries = [...new URLSearchParams(search).entries()].map(([key, value]) => {
    const shown = CURSOR_KEYS.has(key) && value !== '' ? ':cursor' : normaliseText(value);
    return `${key}=${shown}`;
  });
  return entries.sort().join('&');
}

export function lengthClass(length: number): string {
  if (length === 0) return 'len0';
  if (length <= 8) return 'len1-8';
  if (length <= 32) return 'len9-32';
  return 'len33+';
}

export function conditionalKinds(headers: Readonly<Record<string, string>>): string[] {
  const found: string[] = [];
  for (const [name, value] of Object.entries(headers)) {
    if (name === 'if-match' || name === 'if-none-match') {
      const kind = value === '*' ? 'star' : value.startsWith('W/') ? 'weak' : 'strong';
      found.push(`${name}:${kind}`);
    } else if (NAMED_HEADERS.has(name)) found.push(`${name}:present`);
    else if (name.startsWith('x-')) found.push(`${name}:${normaliseText(value)}`);
  }
  return found.sort();
}

function stringShape(value: string): string {
  const text = normaliseText(value);
  return text.length > LONG_TEXT ? `<str ${lengthClass(text.length)}>` : JSON.stringify(text);
}

function jsonShape(key: string | null, value: unknown): string {
  if (typeof value === 'string') {
    return key !== null && SECRET_KEY.test(key)
      ? `<secret ${lengthClass(value.length)}>`
      : stringShape(value);
  }
  if (typeof value === 'number') return /^\d{10,}$/u.test(String(value)) ? ':num' : String(value);
  if (value === null || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const shown = value.slice(0, 10).map((item) => jsonShape(key, item));
    return `[${[...shown, ...(value.length > 10 ? [`+${String(value.length - 10)}`] : [])].join(',')}]`;
  }
  if (typeof value === 'object') {
    const fields = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${fields.map(([name, inner]) => `${name}:${jsonShape(name, inner)}`).join(',')}}`;
  }
  return '<unknown>';
}

function parsed(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function bodyShape(contentType: string | null, text: string | null): string | null {
  if (text === null || text === '') return null;
  const mime = (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (mime === 'application/json') {
    const value = parsed(text);
    if (value !== undefined) return jsonShape(null, value);
  }
  if (mime === 'application/x-www-form-urlencoded') {
    const fields = [...new URLSearchParams(text).entries()].map(([key, value]) =>
      SECRET_KEY.test(key)
        ? `${key}=<secret ${lengthClass(value.length)}>`
        : `${key}=${normaliseText(value)}`,
    );
    return fields.sort().join('&');
  }
  return `<bytes ${lengthClass(text.length)}>`;
}

export function valueClass(value: string): string {
  if (value.startsWith('{') || value.startsWith('[')) {
    const inner = parsed(value);
    if (typeof inner === 'object' && inner !== null) return `json${classOfJson(inner)}`;
  }
  const text = normaliseText(value);
  return WORD.test(text) ? `word:${text}` : lengthClass(value.length);
}

function classOfJson(value: unknown): string {
  if (typeof value === 'string') return valueClass(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.slice(0, 10).map(classOfJson).join(',')}]`;
  if (typeof value === 'object') {
    const fields = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${fields.map(([name, inner]) => `${normaliseText(name)}:${classOfJson(inner)}`).join(',')}}`;
  }
  return '<unknown>';
}

export interface FocusTarget {
  readonly tag: string;
  readonly role: string | null;
  readonly name: string;
  readonly dialog: boolean;
}

export function focusDescriptor(target: FocusTarget): string {
  const name = normaliseText(target.name.replace(/\s+/gu, ' ').trim()).slice(0, 40);
  const role = target.role === null ? '' : `[${target.role}]`;
  return `${target.dialog ? 'dialog' : 'page'} ${target.tag}${role} "${name}"`;
}
