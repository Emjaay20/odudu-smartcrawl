import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  inventories,
  mentions,
  pageKindFiles,
  PAGE_KIND_ALIASES,
  PROTOCOL_TERMS,
  writtenPages,
  type Item,
} from './support/inventories.js';
import { REPO_ROOT } from './markdown.js';

// Each inventory item (support/inventories.ts) is named on a page somebody
// wrote, or sits in not-documented.json with a reason and a phase. A contract
// field also counts when the admin API reference has words for it.
// Cannot see: a name mentioned in passing passes (questions.md covers depth);
// the generated reference and transcripts are not read; environment
// variables and routes are held by the env-reads and endpoints tests.

interface Excuse {
  readonly inventory: string;
  readonly item: string;
  readonly reason: string;
  readonly phase: string;
}

const EXCUSES_FILE = path.join(REPO_ROOT, 'tests/docs/not-documented.json');
const excuses = (): Excuse[] => JSON.parse(readFileSync(EXCUSES_FILE, 'utf8')) as Excuse[];

const pages = writtenPages();
const corpus = pages.map((page) => page.text).join('\n');
const all = inventories();
const everyItem: Item[] = Object.values(all).flat();
const undocumented = (): Item[] =>
  everyItem.filter((item) => item.explained !== true && !mentions(corpus, item.names));
const excused = (item: Item): boolean =>
  excuses().some((e) => e.inventory === item.inventory && e.item === item.key);

describe('the inventories', () => {
  it('are not empty, so a changed pattern fails instead of passing vacuously', () => {
    expect(all['console-labels']?.length).toBeGreaterThan(200);
    expect(all['contract-fields']?.length).toBeGreaterThan(100);
    expect(all['tenant-settings']?.length).toBeGreaterThan(30);
    expect(all['cli-commands']?.length).toBeGreaterThan(15);
    expect(all['server-pages']?.length).toBeGreaterThan(10);
    expect(pages.length).toBeGreaterThan(50);
  });

  it('list every server page renderer, so a new page kind is named here first', () => {
    expect(pageKindFiles().filter((stem) => PAGE_KIND_ALIASES[stem] === undefined)).toEqual([]);
  });

  it('name only protocol terms the protocol source holds', () => {
    const source = ['protocol-oidc', 'protocol-admin', 'contracts']
      .map((pkg) => path.join(REPO_ROOT, 'packages', pkg, 'src'))
      .flatMap((dir) => readTree(dir))
      .join('\n');
    expect(PROTOCOL_TERMS.filter(([, literal]) => !source.includes(literal))).toEqual([]);
  });
});

describe('the documentation', () => {
  it('names every inventory item, or the item is in not-documented.json', () => {
    const missing = undocumented()
      .filter((item) => !excused(item))
      .map((item) => `${item.inventory}: ${item.key}`);
    expect(missing).toEqual([]);
  });
});

describe('not-documented.json', () => {
  it('gives each entry a reason and the phase that will document it', () => {
    const bad = excuses().filter(
      (e) => e.reason.trim() === '' || !/^P\d+[a-z]?$/u.test(e.phase) || e.item === '',
    );
    expect(bad).toEqual([]);
  });

  it('holds only items that exist and are still undocumented', () => {
    expect(staleEntries(excuses(), undocumented())).toEqual([]);
  });

  it('fails an entry for an item that is documented or does not exist', () => {
    const entry = { inventory: 'tenant-settings', item: 'max_clients', reason: 'x', phase: 'P4g' };
    const open: Item[] = [{ inventory: 'tenant-settings', key: 'max_clients', names: [] }];
    expect(staleEntries([entry], open)).toEqual([]);
    expect(staleEntries([entry], [])).toEqual(['tenant-settings: max_clients']);
    expect(staleEntries([{ ...entry, item: 'no_such_setting' }], open)).toHaveLength(1);
  });
});

function staleEntries(entries: readonly Excuse[], open: readonly Item[]): string[] {
  const names = new Set(open.map((item) => `${item.inventory}|${item.key}`));
  return entries
    .filter((e) => !names.has(`${e.inventory}|${e.item}`))
    .map((e) => `${e.inventory}: ${e.item}`);
}

function readTree(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? readTree(path.join(dir, entry.name))
      : entry.name.endsWith('.ts') && !entry.name.includes('.test.')
        ? [readFileSync(path.join(dir, entry.name), 'utf8')]
        : [],
  );
}
