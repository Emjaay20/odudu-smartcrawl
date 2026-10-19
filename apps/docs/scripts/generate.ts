import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildAdminOpenApiDocument } from '@odudu/protocol-admin';
import { renderOpenApiPages } from './openapi-pages.ts';

const APP_ROOT = path.resolve(import.meta.dirname, '..');

// Everything under these two directories is written here and nowhere else, so
// each is emptied before a run and ignored by git.
export const GENERATED_DIRS = ['content/en/reference/generated', 'static/openapi'] as const;
const REFERENCE_DIR = GENERATED_DIRS[0];

export function commitOf(): string {
  const fromEnvironment = process.env.ODUDU_COMMIT;
  if (fromEnvironment !== undefined && fromEnvironment !== '') return fromEnvironment;
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: APP_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

// The banner goes after the front matter, which has to stay the first thing in the file.
export function withBanner(page: string, source: string, commit: string): string {
  const end = page.indexOf('\n---\n', 4) + '\n---\n'.length;
  const banner = `<!-- Generated from ${source} at ${commit}; do not edit. -->\n`;
  return `${page.slice(0, end)}\n${banner}${page.slice(end)}`;
}

export interface Source {
  readonly name: string;
  readonly pages: ReadonlyMap<string, string>;
}

export function sources(): readonly Source[] {
  return [
    {
      name: 'the OpenAPI document of @odudu/protocol-admin',
      pages: renderOpenApiPages(buildAdminOpenApiDocument()),
    },
  ];
}

// Paths relative to the docs app, with the content to write at each.
export function generatedFiles(commit: string): ReadonlyMap<string, string> {
  const files = new Map<string, string>();
  for (const source of sources()) {
    for (const [name, page] of source.pages) {
      files.set(`${REFERENCE_DIR}/${name}`, withBanner(page, source.name, commit));
    }
  }
  files.set(
    `${REFERENCE_DIR}/admin-api/_category_.json`,
    `${JSON.stringify({ label: 'Admin API' }, null, 2)}\n`,
  );
  files.set(
    'static/openapi/admin.json',
    `${JSON.stringify(buildAdminOpenApiDocument(), null, 2)}\n`,
  );
  return new Map([...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export function writeGenerated(root: string, files: ReadonlyMap<string, string>): void {
  for (const dir of GENERATED_DIRS) rmSync(path.join(root, dir), { recursive: true, force: true });
  for (const [name, content] of files) {
    const target = path.join(root, name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
}

if (import.meta.main) {
  const files = generatedFiles(commitOf());
  writeGenerated(APP_ROOT, files);
  console.log(`generated ${String(files.size)} files`);
}
