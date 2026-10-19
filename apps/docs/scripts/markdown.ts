// Prose in a generated page is Markdown parsed as CommonMark (`.md`, never
// `.mdx`), where `{x}` is plain text but a `<tag>` or an `&entity;` is read as
// HTML. So `<`, `>` and `&` become entities everywhere except in a code span, where
// they are literal and an entity would be shown as written.
const CODE_SPAN = /(`+)([\s\S]*?[^`])\1(?!`)/gu;

function escapeMarkup(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function escapeProse(text: string): string {
  let result = '';
  let last = 0;
  for (const match of text.matchAll(CODE_SPAN)) {
    result += escapeMarkup(text.slice(last, match.index)) + match[0];
    last = match.index + match[0].length;
  }
  return result + escapeMarkup(text.slice(last));
}

const FENCE = /^\s*(`{3,}|~{3,})/u;

// Escapes the prose of a Markdown document and leaves its fenced blocks as written.
export function escapeBody(markdown: string): string {
  let fence: string | null = null;
  return markdown
    .split('\n')
    .map((line) => {
      const marker = FENCE.exec(line)?.[1];
      if (fence === null) {
        if (marker === undefined) return escapeProse(line);
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

// One line, with `|` escaped, so a value never ends its table cell early.
export function cell(text: string): string {
  return escapeProse(text)
    .replace(/\s*\n\s*/gu, ' ')
    .replaceAll('|', '\\|')
    .trim();
}

export function code(text: string): string {
  const flat = text.replace(/\s*\n\s*/gu, ' ');
  const longest = Math.max(0, ...[...flat.matchAll(/`+/gu)].map((match) => match[0].length));
  const fence = '`'.repeat(longest + 1);
  const padded = flat.startsWith('`') || flat.endsWith('`') ? ` ${flat} ` : flat;
  return `${fence}${padded}${fence}`;
}

// Inline code inside a raw HTML block, where Markdown does not apply.
export function codeHtml(text: string): string {
  return `<code>${text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</code>`;
}

export function codeCell(text: string): string {
  return code(text).replaceAll('|', '\\|');
}

export function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const line = (cells: readonly string[]): string => `| ${cells.join(' | ')} |`;
  return [line(headers), line(headers.map(() => '---')), ...rows.map(line)].join('\n');
}

// A double-quoted JSON string is a valid YAML scalar.
export function frontMatter(title: string, description: string): string {
  return `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\n---\n`;
}

const ACRONYMS = new Set(['smtp', 'api', 'url', 'uri', 'id', 'jwks', 'oidc']);

export function titleCase(segment: string): string {
  const words = segment.split('-');
  const [first = '', ...rest] = words;
  const word = (text: string): string => (ACRONYMS.has(text) ? text.toUpperCase() : text);
  const head = word(first);
  return [`${head.charAt(0).toUpperCase()}${head.slice(1)}`, ...rest.map(word)].join(' ');
}

export function page(title: string, description: string, body: string): string {
  return `${frontMatter(title, description)}\n# ${title}\n\n${body.trim()}\n`;
}
