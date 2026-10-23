import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { DOCS_DIRECTORY, IMAGE_BASE, PAGES_DOCS_BASE } from '#docs/site.config.ts';

export const DOCS_ROOT = path.resolve(import.meta.dirname, '../..');

export type Target = 'pages' | 'image';

export function distDir(target: Target): string {
  const dir = path.join(DOCS_ROOT, 'dist', target);
  if (!existsSync(path.join(dir, 'index.html'))) {
    throw new Error(`${dir} is not built: run pnpm --filter @odudu/docs build:${target}`);
  }
  return dir;
}

// Where a build writes the documentation: under `docs/` beside the Pages
// landing, at the root of the image, which the server mounts at `/docs/`.
export function docsDir(target: Target): string {
  return target === 'pages' ? path.join(distDir(target), DOCS_DIRECTORY) : distDir(target);
}

// The URL path the documentation starts at in a build.
export function docsBase(target: Target): string {
  return target === 'pages' ? PAGES_DOCS_BASE : IMAGE_BASE;
}

export function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

export function htmlFiles(dir: string): string[] {
  return walk(dir).filter((file) => file.endsWith('.html'));
}

export function load(file: string): cheerio.CheerioAPI {
  return cheerio.load(readFileSync(file, 'utf8'));
}

// The URL path a built file answers, under the base the build was given.
export function routeOf(dir: string, file: string, base: string): string {
  const relative = path.relative(dir, file).split(path.sep).join('/');
  const withoutIndex = relative.replace(/(^|\/)index\.html$/u, '$1');
  return `${base}${withoutIndex}`;
}

export function fileOf(dir: string, base: string, pathname: string): string | null {
  if (!pathname.startsWith(base)) return null;
  const relative = decodeURIComponent(pathname.slice(base.length));
  const candidate = relative.endsWith('/') || relative === '' ? `${relative}index.html` : relative;
  return path.join(dir, candidate);
}

export function isDocumentRoute(route: string, base: string): boolean {
  const rest = route.slice(base.length);
  return rest !== '404.html' && !rest.startsWith('search/');
}

// Every reference the page makes to a file of its own site, resolved against the page's route.
export function internalReferences(
  $: cheerio.CheerioAPI,
  route: string,
): { attribute: string; pathname: string }[] {
  const references: { attribute: string; pathname: string }[] = [];
  const selectors: [string, string][] = [
    ['a[href]', 'href'],
    ['link[href]', 'href'],
    ['script[src]', 'src'],
    ['img[src]', 'src'],
  ];
  for (const [selector, attribute] of selectors) {
    $(selector).each((_, element) => {
      const value = $(element).attr(attribute);
      if (value === undefined || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(value)) return;
      const url = new URL(value, `http://site.test${route}`);
      references.push({ attribute: `${selector} ${value}`, pathname: url.pathname });
    });
  }
  return references;
}
