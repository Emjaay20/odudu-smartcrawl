import { describe, expect, it } from 'vitest';
import { lostArt } from '#/view/lost-art';

// That this is the drawing in packages/instrument is held by
// tests/lint/lost-art.test.ts, which reads across packages.
describe('lostArt', () => {
  it('is decorative: hidden from assistive technology, with no title or text', () => {
    const art = lostArt(false);
    expect(art).toContain('aria-hidden="true"');
    expect(art).not.toMatch(/<(title|desc|text|script|style)\b/u);
    expect(art).not.toContain('style=');
  });

  it('stays small', () => {
    expect(Buffer.byteLength(lostArt(false))).toBeLessThan(1024);
  });

  it('is still when calm, by the one class the stylesheet keys on', () => {
    expect(lostArt(false)).toContain('class="lost"');
    expect(lostArt(true)).toContain('class="lost lost-calm"');
    expect(lostArt(true).replace(' lost-calm', '')).toBe(lostArt(false));
  });
});
