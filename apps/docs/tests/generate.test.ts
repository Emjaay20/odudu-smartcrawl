import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildAdminOpenApiDocument } from '@odudu/protocol-admin';
import { MACHINE_READABLE_REFERENCES } from '#docs/nav.ts';
import { GENERATED_DIRS, generatedFiles, writeGenerated } from '#docs/scripts/generate.ts';
import { DOCS_ROOT, walk } from '#docs/tests/support/dist.ts';

const COMMIT = 'abc1234';
const files = await generatedFiles(COMMIT);
const pages = [...files].filter(([name]) => name.endsWith('.md'));
const scratch = mkdtempSync(path.join(tmpdir(), 'odudu-generate-'));

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe('writing the generated reference', () => {
  it('begins every page with its front matter, then a banner naming the source and the commit', () => {
    expect(pages.length).toBeGreaterThan(10);
    for (const [name, text] of pages) {
      expect(text, name).toMatch(
        /^---\ntitle: .+\ndescription: .+\n---\n\n<!-- Generated from .+ at abc1234; do not edit\. -->\n\n# /u,
      );
    }
  });

  it('writes nothing outside the two directories git ignores', () => {
    for (const name of files.keys()) {
      expect(
        GENERATED_DIRS.some((dir) => name.startsWith(`${dir}/`)),
        name,
      ).toBe(true);
    }
  });

  it('is deterministic, in content and in order', async () => {
    expect([...(await generatedFiles(COMMIT))]).toEqual([...files]);
    expect([...files.keys()]).toEqual([...files.keys()].sort());
  });

  it('empties what it generates before it writes, so a removed page does not linger', () => {
    const stale = path.join(scratch, GENERATED_DIRS[0], 'admin-api/removed.md');
    mkdirSync(path.dirname(stale), { recursive: true });
    writeFileSync(stale, 'old');
    const kept = path.join(scratch, 'content/en/reference/index.md');
    mkdirSync(path.dirname(kept), { recursive: true });
    writeFileSync(kept, 'hand written');

    writeGenerated(scratch, files);

    expect(existsSync(stale)).toBe(false);
    expect(readFileSync(kept, 'utf8')).toBe('hand written');
    for (const [name, text] of files) {
      expect(readFileSync(path.join(scratch, name), 'utf8'), name).toBe(text);
    }
  });

  it('writes every machine-readable reference the site lists, and the admin OpenAPI document is the one the server builds', () => {
    for (const reference of MACHINE_READABLE_REFERENCES) {
      expect(files.has(`static/${reference.file}`), reference.file).toBe(true);
    }
    const written = JSON.parse(files.get('static/openapi/admin.json') ?? 'null') as unknown;
    expect(written).toEqual(JSON.parse(JSON.stringify(buildAdminOpenApiDocument())));
  });
});

describe('the generated reference on disk', () => {
  // The docs build and its tests read these files, so they must say what the
  // code says now. They are written by `pnpm generate`, which every build runs.
  it('is what the code generates now, apart from the commit it names', async () => {
    const first = path.join(DOCS_ROOT, [...files.keys()][0] ?? '');
    expect(existsSync(first), 'run pnpm --filter @odudu/docs generate').toBe(true);
    const named = /at ([0-9a-f]+|unknown); do not edit/u.exec(
      readFileSync(path.join(DOCS_ROOT, pages[0]?.[0] ?? ''), 'utf8'),
    )?.[1];
    const fresh = await generatedFiles(named ?? 'unknown');

    const onDisk = GENERATED_DIRS.flatMap((dir) =>
      walk(path.join(DOCS_ROOT, dir)).map((file) =>
        path.relative(DOCS_ROOT, file).split(path.sep).join('/'),
      ),
    ).sort();
    expect(onDisk).toEqual([...fresh.keys()]);
    for (const [name, text] of fresh) {
      expect(readFileSync(path.join(DOCS_ROOT, name), 'utf8') === text, name).toBe(true);
    }
  });

  it('is linked from the reference index, so every page is two clicks from the home page', () => {
    const index = readFileSync(path.join(DOCS_ROOT, 'content/en/reference/index.md'), 'utf8');
    const prefix = 'content/en/reference/';
    const missing = pages
      .map(([name]) => name.slice(prefix.length))
      .filter((page) => !index.includes(`](./${page})`));
    expect(missing).toEqual([]);
  });
});
