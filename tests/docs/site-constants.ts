import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from './markdown.js';

// The docs app is a CommonJS package that these checks cannot type-import, so
// its address and owner constants are read at run time and each one is checked
// to be a string.
const NAMES = [
  'REPOSITORY_URL',
  'TRADEMARK_URL',
  'OWNER_NOTICE_NAME',
  'OWNER_NOTICE',
  'SITE_ORIGIN',
  'PAGES_BASE',
  'PAGES_DOCS_BASE',
] as const;

export type SiteConstants = Record<(typeof NAMES)[number], string>;

async function read(file: string): Promise<Record<string, unknown>> {
  const loaded: unknown = await import(pathToFileURL(path.join(REPO_ROOT, file)).href);
  if (typeof loaded !== 'object' || loaded === null) throw new Error(`${file} exports nothing`);
  return loaded as Record<string, unknown>;
}

export async function siteConstants(): Promise<SiteConstants> {
  const found = {
    ...(await read('apps/docs/nav.ts')),
    ...(await read('apps/docs/site.config.ts')),
  };
  const values = NAMES.map((name) => {
    const value = found[name];
    if (typeof value !== 'string') throw new Error(`${name} is not a string in apps/docs`);
    return [name, value] as const;
  });
  return Object.fromEntries(values) as SiteConstants;
}
