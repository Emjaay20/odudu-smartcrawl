import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PAGE_KINDS } from '@odudu/kernel';
import { describe, expect, it } from 'vitest';
import { CSS_ELEMENTS, CSS_HOOKS, CSS_HOOKS_VERSION, CSS_TOKENS } from '#/service/hooks';

const PACKAGES = join(import.meta.dirname, '..', '..', '..');

const renderedClasses = (): Set<string> => {
  const found = new Set<string>();
  for (const pkg of readdirSync(PACKAGES)) {
    const dir = join(PACKAGES, pkg, 'src', 'view');
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith('-html.ts') || f === 'document.ts');
    } catch {
      continue;
    }
    for (const file of files) {
      const source = readFileSync(join(dir, file), 'utf8');
      for (const match of source.matchAll(/class="([^"]*)"/g)) {
        for (const name of (match[1] ?? '').split(/\s+/).filter(Boolean)) found.add(name);
      }
    }
  }
  return found;
};

describe('CSS hooks', () => {
  it('is versioned', () => {
    expect(CSS_HOOKS_VERSION).toBe(1);
  });

  it('names every class the server pages render today', () => {
    const rendered = renderedClasses();
    expect(rendered.size).toBeGreaterThan(5);
    for (const name of rendered) expect(CSS_HOOKS, name).toContain(name);
  });

  it('carries a page- hook for each of the 16 page kinds', () => {
    const kinds = Object.keys(PAGE_KINDS);
    expect(kinds).toHaveLength(16);
    for (const kind of kinds) expect(CSS_HOOKS).toContain(`page-${kind}`);
  });

  it('has no duplicates and only plain class names', () => {
    expect(new Set(CSS_HOOKS).size).toBe(CSS_HOOKS.length);
    for (const name of CSS_HOOKS) expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('lists the element types a selector may use', () => {
    expect(CSS_ELEMENTS).toEqual(
      'main h1 h2 h3 p a ul ol li label input button small code img span div section header footer form'.split(
        ' ',
      ),
    );
  });

  it('lists every token the server stylesheet reads', () => {
    const css = readFileSync(join(PACKAGES, 'instrument', 'src', 'pages.css'), 'utf8');
    const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
    expect(used.size).toBeGreaterThan(10);
    for (const token of used) expect(CSS_TOKENS, token).toContain(token);
  });
});
