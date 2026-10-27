import { describe, expect, it } from 'vitest';
import { PAGE_KINDS } from '#/page-kinds';

describe('PAGE_KINDS', () => {
  it('names each part at most once per kind, required or optional', () => {
    for (const [kind, manifest] of Object.entries(PAGE_KINDS)) {
      const all = [...manifest.required, ...manifest.optional];
      expect(new Set(all).size, kind).toBe(all.length);
    }
  });

  it('opens and closes a form together', () => {
    for (const [kind, manifest] of Object.entries(PAGE_KINDS)) {
      const has = (name: string): boolean =>
        manifest.required.includes(name) || manifest.optional.includes(name);
      expect(has('form.open'), kind).toBe(has('form.close'));
    }
  });
});
