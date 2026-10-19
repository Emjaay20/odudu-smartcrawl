import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

function pages(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
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
  if (value !== '' && !/^[>|][-+]?$/u.test(value)) return true;
  return /^\s+\S/u.test(lines[index + 1] ?? '');
}

// Docusaurus would write a description from the first paragraph, which
// reads as a page that has one; a page needs its own.
export function missingDescriptions(contentDir: string): string[] {
  return pages(contentDir)
    .filter((page) => !hasDescription(readFileSync(path.join(contentDir, page), 'utf8')))
    .sort();
}

export function requireDescriptions(contentDir: string): void {
  const missing = missingDescriptions(contentDir);
  if (missing.length > 0) {
    throw new Error(`Pages without a front-matter description: ${missing.join(', ')}`);
  }
}
