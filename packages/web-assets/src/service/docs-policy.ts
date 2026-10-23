export interface DocsCsp {
  readonly scriptHashes: readonly string[];
  readonly styleAttributeHashes: readonly string[];
}

// A SHA-256 digest is 32 bytes, which is 43 base64 characters and one `=`.
// The pattern is the whole defence against a value that closes a source list
// or opens a directive, so it admits nothing else.
const HASH = /^sha256-[A-Za-z0-9+/]{43}=$/u;

function sources(hashes: readonly string[]): string {
  return hashes
    .map((hash) => {
      if (!HASH.test(hash)) throw new Error(`not a sha256 hash source: ${JSON.stringify(hash)}`);
      return `'${hash}'`;
    })
    .join(' ');
}

function directive(name: string, base: string, hashes: readonly string[]): string {
  const list = sources(hashes);
  return list === '' ? `${name} ${base}` : `${name} ${base} ${list}`;
}

// The policy the built documentation runs under. Docusaurus emits one inline
// script per page and a handful of `style=` attributes, and no `<style>`
// element, so both are licensed by hash and nothing is `'unsafe-inline'`.
// `style-src-attr` governs only style attributes: a `<style>` element or a
// style set from script stays under `style-src 'self'`. `data:` images are the
// theme's chevron, menu and copy-button icons. The site embeds no plugin
// content and frames nothing, so those two are closed rather than left to
// fall back to `default-src`; workers fall back to it, and are `'self'`.
export function docsPolicy(csp: DocsCsp): string {
  return [
    "default-src 'self'",
    directive('script-src', "'self'", csp.scriptHashes),
    "style-src 'self'",
    csp.styleAttributeHashes.length === 0
      ? "style-src-attr 'none'"
      : directive('style-src-attr', "'unsafe-hashes'", csp.styleAttributeHashes),
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
}

function hashList(value: unknown, name: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${name} is not a list`);
  return value.map((hash: unknown) => {
    if (typeof hash !== 'string' || !HASH.test(hash)) {
      throw new Error(`${name} holds a value that is not a sha256 hash source`);
    }
    return hash;
  });
}

// What `csp.json` must be: the build writes it, and a file that is anything
// else is not the build the policy was computed for.
export function parseDocsCsp(value: unknown): DocsCsp {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('csp.json is not an object');
  }
  const record = value as Record<string, unknown>;
  return {
    scriptHashes: hashList(record.scriptHashes, 'scriptHashes'),
    styleAttributeHashes: hashList(record.styleAttributeHashes, 'styleAttributeHashes'),
  };
}

// What a response says when there is no build to compute a policy from: it
// carries no markup, so nothing may load.
export const UNAVAILABLE_POLICY = "default-src 'none'";
