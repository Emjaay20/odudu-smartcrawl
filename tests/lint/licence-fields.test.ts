import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT, loadDocument, tableWithHeadings } from '../docs/markdown.js';

function read(relative: string): string {
  return readFileSync(path.join(REPO_ROOT, relative), 'utf8');
}

function assignedLicences(): Map<string, string> {
  const table = tableWithHeadings(loadDocument('LICENSING.md'), ['Path', 'Licence']);
  return new Map(
    table.rows.map((row) => [
      (row[0] ?? '').replaceAll('`', ''),
      (row[1] ?? '').replaceAll('`', ''),
    ]),
  );
}

function manifests(): string[] {
  return [
    ...globSync('{apps,packages,tools}/*/package.json', { cwd: REPO_ROOT }),
    'tests/package.json',
  ].sort();
}

function licenceFor(table: Map<string, string>, manifest: string): string | undefined {
  const directory = path.dirname(manifest);
  return table.get(directory) ?? table.get(`${path.dirname(directory)}/*`);
}

describe('licence fields', () => {
  it('gives every workspace manifest the licence LICENSING.md assigns its directory', () => {
    const table = assignedLicences();
    for (const manifest of manifests()) {
      const parsed: unknown = JSON.parse(read(manifest));
      const field =
        typeof parsed === 'object' && parsed !== null && 'license' in parsed
          ? parsed.license
          : undefined;
      expect(field, manifest).toBe(licenceFor(table, manifest));
    }
  });

  it('has no manifest the table does not cover', () => {
    const table = assignedLicences();
    const uncovered = manifests().filter((manifest) => licenceFor(table, manifest) === undefined);
    expect(uncovered).toEqual([]);
  });

  it('ships both licence texts', () => {
    expect(read('LICENSE').trimStart()).toMatch(/^GNU AFFERO GENERAL PUBLIC LICENSE/u);
    expect(read('LICENSES/Apache-2.0.txt').trimStart()).toMatch(/^Apache License/u);
  });

  it('keeps the name and mark out of both licences', () => {
    expect(read('LICENSING.md')).toContain('The name Odudu and the staff mark are not licensed');
  });
});
