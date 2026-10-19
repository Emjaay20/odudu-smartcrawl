import { describe, expect, it } from 'vitest';
import { page } from '../../packages/protocol-oidc/src/view/document.js';
import { loadDocument, scanFences } from './markdown.js';

// A recorded page response is a claim about bytes: its `content-length` is
// the length of the document under it, and the document is the shell around
// the page's own markup. A block that shows only part of a document says so
// with a `…` in its body; every other block is held to the shell and, where
// it shows a `content-length`, to that length.
const GUIDES = ['docs/request-paths.md', 'docs/console-paths.md', 'docs/admin-paths.md'];
const MARKER = '@@';

interface Recorded {
  readonly where: string;
  readonly lines: readonly string[];
}

function recorded(): Recorded[] {
  return GUIDES.flatMap((guide) =>
    scanFences(loadDocument(guide)).spans.flatMap((span) => {
      const start = span.body.indexOf('<!doctype html>');
      const page = span.body.some((line) =>
        line.startsWith("content-security-policy: default-src 'none'"),
      );
      if (!(span.body[0] ?? '').startsWith('HTTP/1.1 ') || start === -1 || !page) return [];
      return [{ where: `${guide}:${String(span.startLine)}`, lines: span.body }];
    }),
  );
}

// A fence may go on to hold the next command, so the document ends at its own
// closing tag when it has one.
function documentOf(block: Recorded): string[] {
  const rest = block.lines.slice(block.lines.indexOf('<!doctype html>'));
  const end = rest.indexOf('</html>');
  return end === -1 ? rest : rest.slice(0, end + 1);
}
const isPartial = (block: Recorded): boolean =>
  documentOf(block).some((line) => line.includes('…'));
const complete = (): Recorded[] => recorded().filter((block) => !isPartial(block));

// reloadOnRestore appends this after the shell's closing `</main>`.
const RELOAD_ON_RESTORE =
  /\n<script nonce="[^"]*">window\.addEventListener\('pageshow'[^\n]*<\/script>\n<\/body>/u;

// The shell around a page, split where a title and a body go.
const [BEFORE_TITLE = '', BETWEEN = '', AFTER_BODY = ''] = page(MARKER, MARKER).html.split(MARKER);

// The title is recorded as served, escaped; page() escapes what it is given.
const unescaped = (text: string): string =>
  text
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/&amp;/gu, '&');

describe('the page documents the guides record', () => {
  it('finds complete documents in every guide, so an empty scan cannot pass', () => {
    for (const guide of GUIDES) {
      expect(
        complete().some((block) => block.where.startsWith(`${guide}:`)),
        guide,
      ).toBe(true);
    }
  });

  it('shows a document that stops short only with a … in it', () => {
    const unmarked = recorded()
      .filter((block) => !isPartial(block) && documentOf(block).at(-1) !== '</html>')
      .map((block) => block.where);
    expect(unmarked).toEqual([]);
  });

  it('gives each complete document the content-length its bytes have', () => {
    const wrong = complete().flatMap((block) => {
      const header = block.lines.find((line) => line.startsWith('content-length: '));
      if (header === undefined) return [];
      const bytes = Buffer.byteLength(documentOf(block).join('\n'));
      return header === `content-length: ${String(bytes)}`
        ? []
        : [`${block.where}: ${header}, ${String(bytes)} bytes`];
    });
    expect(wrong).toEqual([]);
  });

  it('wraps each complete document in the shell page() builds', () => {
    const drift = complete().flatMap((block) => {
      const text = documentOf(block).join('\n').replace(RELOAD_ON_RESTORE, '\n</body>');
      const titleEnd = text.indexOf(BETWEEN, BEFORE_TITLE.length);
      const ok =
        text.startsWith(BEFORE_TITLE) &&
        titleEnd !== -1 &&
        text.endsWith(AFTER_BODY) &&
        page(
          unescaped(text.slice(BEFORE_TITLE.length, titleEnd)),
          text.slice(titleEnd + BETWEEN.length, text.length - AFTER_BODY.length),
        ).html === text;
      return ok ? [] : [block.where];
    });
    expect(drift).toEqual([]);
  });
});
