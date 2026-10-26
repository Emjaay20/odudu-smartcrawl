import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRAND_TOKENS, brandStyle, undeclared } from './brand.ts';

const tokens = readFileSync(
  path.resolve(import.meta.dirname, '../../../admin-console/src/shared/view/tokens.css'),
  'utf8',
);

describe('the other brand', () => {
  it('replaces only tokens the stylesheet declares', () => {
    expect(undeclared(tokens)).toEqual([]);
    expect(undeclared('')).toEqual(Object.keys(BRAND_TOKENS));
  });

  it('replaces colours and nothing else', () => {
    for (const [name, value] of Object.entries(BRAND_TOKENS)) {
      expect(value, name).toMatch(/^light-dark\(#[0-9a-f]{6}, #[0-9a-f]{6}\)$/u);
    }
  });

  it('is one style element that sets the tokens on the root', () => {
    const style = brandStyle();
    expect(style.startsWith('<style>:root {')).toBe(true);
    for (const name of Object.keys(BRAND_TOKENS)) expect(style).toContain(`${name}:`);
  });
});
