import path from 'node:path';

export interface LinkTarget {
  readonly base: string;
  readonly origin: string | null;
  // Where the docs plugin serves from, relative to the base: `docs/` or empty.
  readonly docs: string;
}

const STATIC_FILE = 'pathname:///';
const NOT_A_SITE_PATH = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/iu;
// A destination is either `<...>` or a run that may hold one level of balanced parentheses.
const DESTINATION = String.raw`<[^>\n]*>|(?:[^()\s]|\([^()\s]*\))+`;
const TITLE = String.raw`(?:\s+(?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\)))?`;
// The opening bracket is not required: hard-wrapped prose breaks a link's text across lines.
const LINK = new RegExp(String.raw`(\]\()(${DESTINATION})(${TITLE}\s*\))`, 'gu');
const DEFINITION = new RegExp(String.raw`^(\s{0,3}\[[^\]\n]+\]:\s*)(${DESTINATION})`, 'u');
// Raw HTML is read one line at a time and only for quoted attributes.
const HTML_REFERENCE = /(<(?:a|img)\b[^>]*?\s(?:href|src)=)(?:"([^"]*)"|'([^']*)')/giu;
const INLINE_CODE = /`+[^`]*`+/gu;
const FENCE = /^\s*(`{3,}|~{3,})/u;

function routeOfDocument(file: string): string {
  const stem = file.replace(/\.mdx?$/u, '');
  return stem.endsWith('/index') ? stem.slice(0, -'index'.length) : `${stem}/`;
}

// A Markdown copy lives at another address than its source, so a link the
// build resolved for the HTML page means nothing in it until it is made site-wide.
function rewriteTarget(raw: string, source: string, target: LinkTarget): string {
  // The page's own form for a file in `static/`, which the build must not bundle as an asset.
  if (raw.startsWith(STATIC_FILE)) {
    return `${target.origin ?? ''}${target.base}${raw.slice(STATIC_FILE.length)}`;
  }
  if (NOT_A_SITE_PATH.test(raw)) return raw;
  const [, filePart = '', rest = ''] = /^([^#?]*)(.*)$/u.exec(raw) ?? [];
  if (filePart === '') return raw;
  const isDocument = /\.mdx?$/u.test(filePart);
  const site = `${target.origin ?? ''}${target.base}`;
  if (filePart.startsWith('/')) {
    return isDocument
      ? `${site}${target.docs}${routeOfDocument(filePart).slice(1)}${rest}`
      : `${site}${filePart.slice(1)}${rest}`;
  }
  if (!isDocument) return raw;
  const route = routeOfDocument(path.posix.resolve('/', path.posix.dirname(source), filePart));
  return `${site}${target.docs}${route.slice(1)}${rest}`;
}

function inBrackets(destination: string, replace: (raw: string) => string): string {
  return destination.startsWith('<') && destination.endsWith('>')
    ? `<${replace(destination.slice(1, -1))}>`
    : replace(destination);
}

interface Edit {
  readonly start: number;
  readonly end: number;
}

// Code spans are blanked, not cut out, so a link whose text is inline code is
// still seen whole and every offset found in the blanked line holds in the line.
function maskCode(line: string): string {
  return line.replace(INLINE_CODE, (span) => '\u0000'.repeat(span.length));
}

// Whether a `[` is still waiting for its `]` at the end of a line.
function endsInsideLinkText(masked: string): boolean {
  return masked.lastIndexOf('[') > masked.lastIndexOf(']');
}

// A target counts only after link text: a `[` open before it on its line, or
// left open by the line above in the same paragraph.
function followsLinkText(before: string, continues: boolean): boolean {
  return endsInsideLinkText(before) || (continues && !before.includes(']'));
}

function mapLine(line: string, replace: (raw: string) => string, continues: boolean): string {
  const defined = line.replace(
    DEFINITION,
    (_, open: string, destination: string) => `${open}${inBrackets(destination, replace)}`,
  );
  const masked = maskCode(defined);
  const edits: Edit[] = [];
  for (const match of masked.matchAll(LINK)) {
    if (!followsLinkText(masked.slice(0, match.index), continues)) continue;
    const start = match.index + (match[1] ?? '').length;
    edits.push({ start, end: start + (match[2] ?? '').length });
  }
  for (const match of masked.matchAll(HTML_REFERENCE)) {
    const start = match.index + (match[1] ?? '').length + 1;
    edits.push({ start, end: start + (match[2] ?? match[3] ?? '').length });
  }
  let result = '';
  let cursor = 0;
  for (const { start, end } of edits.sort((a, b) => a.start - b.start)) {
    result += defined.slice(cursor, start);
    const original = defined.slice(start, end);
    result += original.startsWith('<') ? inBrackets(original, replace) : replace(original);
    cursor = end;
  }
  return result + defined.slice(cursor);
}

// Applies `replace` to the target of every link outside code.
function mapLinks(markdown: string, replace: (raw: string) => string): string {
  let fence: string | null = null;
  let open = false;
  return markdown
    .split('\n')
    .map((line) => {
      const marker = FENCE.exec(line)?.[1];
      if (fence === null) {
        if (marker === undefined) {
          const masked = maskCode(line);
          const result = mapLine(line, replace, open);
          open =
            line.trim() !== '' && (endsInsideLinkText(masked) || (open && !masked.includes(']')));
          return result;
        }
        open = false;
        fence = marker;
        return line;
      }
      if (marker?.startsWith(fence.charAt(0)) === true && marker.length >= fence.length) {
        fence = null;
      }
      return line;
    })
    .join('\n');
}

export function rewriteLinks(markdown: string, source: string, target: LinkTarget): string {
  return mapLinks(markdown, (raw) => rewriteTarget(raw, source, target));
}
