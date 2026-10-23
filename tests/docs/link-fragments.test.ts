import { existsSync, globSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { underGenerated } from './generated-links.js';
import { loadDocument, REPO_ROOT, scanFences } from './markdown.js';

// A link whose file exists can still point at a heading that was renamed or
// moved to another page, and the page then opens at its top with nothing to
// say so. This reads every Markdown link carrying a `#fragment` into another
// Markdown file in the repository, outside the archive, and requires a heading
// that makes that anchor.
const SITE = 'apps/docs/content/en/';
const NOT_OURS = new Set(['node_modules', 'dist', 'coverage', '.git', '.superpowers', '.turbo']);

// GitHub's rule, which the site's headings follow too: lower-case, drop
// everything but letters, digits, `_`, `-` and spaces, spaces become `-`.
export function slugOf(heading: string): string {
  return heading
    .replaceAll(/\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replaceAll(/(^|[\s(])_([^_]+)_(?=[\s).,:;]|$)/gu, '$1$2')
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\p{M}_\- ]/gu, '')
    .replaceAll(' ', '-');
}

// A repeated heading gets `-1`, `-2`, in order, as both renderers do. On the
// site a page's `h1` carries no id, so a link to it is a link to the page.
export function anchorsOf(file: string): Set<string> {
  const document = loadDocument(file);
  const { fenced } = scanFences(document);
  const seen = new Map<string, number>();
  const anchors = new Set<string>();
  for (const [index, line] of document.lines.entries()) {
    const match = /^(?<marks>#{1,6}) (?<text>.+?)\s*$/u.exec(line);
    if (fenced[index] === true || match?.groups === undefined) continue;
    const base = slugOf(match.groups.text ?? '');
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const anchor = count === 0 ? base : `${base}-${String(count)}`;
    const isSiteTitle = file.startsWith(SITE) && match.groups.marks === '#';
    if (!isSiteTitle) anchors.add(anchor);
  }
  return anchors;
}

interface Fragment {
  readonly from: string;
  readonly line: number;
  readonly target: string;
  readonly fragment: string;
}

export function fragmentLinks(file: string): Fragment[] {
  const document = loadDocument(file);
  const { fenced } = scanFences(document);
  const text = document.lines.map((line, index) => (fenced[index] === true ? '' : line));
  const found: Fragment[] = [];
  for (const [index, line] of text.entries()) {
    for (const match of line.matchAll(/\]\((?<target>[^)\s#]*)#(?<fragment>[^)\s]+)\)/gu)) {
      const target = match.groups?.target ?? '';
      if (/^[a-z]+:/u.test(target)) continue;
      found.push({
        from: file,
        line: index + 1,
        target:
          target === ''
            ? file
            : path.relative(REPO_ROOT, path.resolve(REPO_ROOT, path.dirname(file), target)),
        fragment: match.groups?.fragment ?? '',
      });
    }
  }
  return found;
}

function documents(): string[] {
  return globSync('**/*.md', {
    cwd: REPO_ROOT,
    exclude: (entry) => {
      const normal = entry.split(path.sep).join('/');
      return (
        NOT_OURS.has(path.basename(entry)) ||
        normal === 'docs/archive' ||
        normal.startsWith('docs/archive/')
      );
    },
  }).sort();
}

describe('slugs and anchors', () => {
  it('slugs a heading as GitHub does', () => {
    expect(slugOf('Redeeming the code with `client_secret_basic`')).toBe(
      'redeeming-the-code-with-client_secret_basic',
    );
    expect(slugOf('4. `/token`')).toBe('4-token');
    expect(slugOf('A [link](x.md) and "quotes"')).toBe('a-link-and-quotes');
    expect(slugOf('Refused _as_ a used code')).toBe('refused-as-a-used-code');
  });
});

describe('every link to a heading in another document names a heading that exists', () => {
  it('finds the links, so an extractor that sees none fails rather than passing', () => {
    const count = documents().reduce((sum, file) => sum + fragmentLinks(file).length, 0);
    expect(count).toBeGreaterThan(100);
  });

  it('resolves each fragment against the headings of the file it targets', () => {
    const headings = new Map<string, Set<string>>();
    const broken: string[] = [];
    for (const file of documents()) {
      for (const link of fragmentLinks(file)) {
        const absolute = path.join(REPO_ROOT, link.target);
        if (!link.target.endsWith('.md') || underGenerated(absolute) || !existsSync(absolute)) {
          continue;
        }
        if (!headings.has(link.target)) headings.set(link.target, anchorsOf(link.target));
        if (headings.get(link.target)?.has(link.fragment) !== true) {
          broken.push(`${link.from}:${String(link.line)} -> ${link.target}#${link.fragment}`);
        }
      }
    }

    expect(broken).toEqual([]);
  });
});
