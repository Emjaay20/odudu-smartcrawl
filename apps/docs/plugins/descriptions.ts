import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

function pages(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('_')) return [];
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) return pages(path.join(dir, entry.name), `${relative}/`);
    return /\.mdx?$/u.test(entry.name) ? [relative] : [];
  });
}

function hasDescription(source: string): boolean {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/u.exec(source);
  if (match?.[1] === undefined) return false;
  const lines = match[1].split(/\r?\n/u);
  const index = lines.findIndex((line) => line.startsWith('description:'));
  if (index === -1) return false;
  const value = (lines[index] ?? '').slice('description:'.length).trim();
  const unquoted = value.replace(/^(["'])(.*)\1$/u, '$2').trim();
  if (unquoted !== '' && !/^[>|][-+]?$/u.test(unquoted)) return true;
  if (value !== unquoted) return false;
  return /^\s+\S/u.test(lines[index + 1] ?? '');
}

// Docusaurus would write a description from the first paragraph, which
// reads as a page that has one; a page needs its own.
export function missingDescriptions(contentDir: string): string[] {
  return pages(contentDir)
    .filter((page) => !hasDescription(readFileSync(path.join(contentDir, page), 'utf8')))
    .sort();
}

// The front-matter reader evaluates `---js`, so the documentation is trusted
// to be authored by its maintainers only: any language tag after the fence is refused.
export function codeFrontMatter(contentDir: string): string[] {
  return pages(contentDir)
    .filter((page) =>
      /^---[A-Za-z]+[ \t]*(?:\r?\n|$)/u.test(readFileSync(path.join(contentDir, page), 'utf8')),
    )
    .sort();
}

export function requireDescriptions(contentDir: string): void {
  const code = codeFrontMatter(contentDir);
  if (code.length > 0) {
    throw new Error(`Pages with front matter that is not plain YAML: ${code.join(', ')}`);
  }
  const missing = missingDescriptions(contentDir);
  if (missing.length > 0) {
    throw new Error(`Pages without a front-matter description: ${missing.join(', ')}`);
  }
}
