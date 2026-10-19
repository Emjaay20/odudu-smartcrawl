import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PAGES_BASE, SITE_ORIGIN } from '#docs/site.config.ts';
import { DOCS_ROOT, type Target } from '#docs/tests/support/dist.ts';

export const IMAGE_BASE = '/docs/';

export interface Entry {
  title: string;
  url: string;
  description: string;
}

// What every address in a target's llms.txt begins with.
export function addressPrefix(target: Target): string {
  return target === 'pages' ? `${SITE_ORIGIN}${PAGES_BASE}` : IMAGE_BASE;
}

export function entriesOf(llmsTxt: string): Entry[] {
  return llmsTxt.split('\n').flatMap((line) => {
    const match = /^- \[([^\]]+)\]\((\S+)\)(?:: (.*))?$/u.exec(line);
    return match === null
      ? []
      : [{ title: match[1] ?? '', url: match[2] ?? '', description: match[3] ?? '' }];
  });
}

// The Markdown copy's path inside the build, from its listed address.
export function copyPath(entry: Entry, target: Target): string {
  return entry.url.slice(addressPrefix(target).length);
}

export function routeOfCopy(entry: Entry, target: Target): string {
  return `/${copyPath(entry, target).replace(/\.md$/u, '')}/`;
}

export function sourceOf(contentDir: string, copy: string): string | null {
  const stem = copy.replace(/\.md$/u, '');
  const candidates = [`${stem}.md`, `${stem}/index.md`];
  return candidates.find((candidate) => existsSync(path.join(contentDir, candidate))) ?? null;
}

export function readSource(contentDir: string, relative: string): string {
  return readFileSync(path.join(contentDir, relative), 'utf8');
}

export const CONTENT_DIR = path.join(DOCS_ROOT, 'content/en');

export function withoutFrontMatter(text: string): string {
  return text.replace(/^---\n[\s\S]*?\n---\n/u, '');
}

// A copy repeats the page title and description before the body; a source
// repeats them in its own way. What is left is the part both must agree on.
export function normalised(text: string, description: string): string {
  return withoutFrontMatter(text)
    .replace(/<!--[\s\S]*?-->/gu, '')
    .split('\n')
    .filter((line) => line !== `> ${description}` && line !== description)
    .join('\n')
    .replace(/^\s*# .*\n/u, '')
    .replace(/\n{2,}/gu, '\n\n')
    .trim();
}
