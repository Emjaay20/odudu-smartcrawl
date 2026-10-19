import path from 'node:path';

export interface LinkTarget {
  readonly base: string;
  readonly origin: string | null;
}

const NOT_A_SITE_PATH = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/iu;
const LINK = /(!?\[[^\]\n]*\]\()([^)\s]+)((?:\s+"[^"\n]*")?\))/gu;
const INLINE_CODE = /(`+[^`]*`+)/u;
const FENCE = /^\s*(`{3,}|~{3,})/u;

function routeOfDocument(file: string): string {
  const stem = file.replace(/\.mdx?$/u, '');
  return stem.endsWith('/index') ? stem.slice(0, -'index'.length) : `${stem}/`;
}

// A Markdown copy lives at another address than its source, so a link the
// build resolved for the HTML page means nothing in it until it is made site-wide.
function rewriteTarget(raw: string, source: string, target: LinkTarget): string {
  if (NOT_A_SITE_PATH.test(raw)) return raw;
  const [, filePart = '', rest = ''] = /^([^#?]*)(.*)$/u.exec(raw) ?? [];
  if (filePart === '') return raw;
  const isDocument = /\.mdx?$/u.test(filePart);
  let sitePath: string;
  if (filePart.startsWith('/')) {
    sitePath = isDocument ? routeOfDocument(filePart) : filePart;
  } else if (isDocument) {
    sitePath = routeOfDocument(path.posix.resolve('/', path.posix.dirname(source), filePart));
  } else {
    return raw;
  }
  return `${target.origin ?? ''}${target.base}${sitePath.slice(1)}${rest}`;
}

function mapLine(line: string, replace: (raw: string) => string): string {
  return line
    .split(INLINE_CODE)
    .map((part, index) =>
      index % 2 === 1
        ? part
        : part.replace(
            LINK,
            (_, open: string, raw: string, close: string) => `${open}${replace(raw)}${close}`,
          ),
    )
    .join('');
}

// Applies `replace` to the target of every link outside code.
function mapLinks(markdown: string, replace: (raw: string) => string): string {
  let fence: string | null = null;
  return markdown
    .split('\n')
    .map((line) => {
      const marker = FENCE.exec(line)?.[1];
      if (fence === null) {
        if (marker === undefined) return mapLine(line, replace);
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

export function linkTargets(markdown: string): string[] {
  const targets: string[] = [];
  mapLinks(markdown, (raw) => {
    targets.push(raw);
    return raw;
  });
  return targets;
}
