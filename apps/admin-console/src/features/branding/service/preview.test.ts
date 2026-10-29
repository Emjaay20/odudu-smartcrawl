import { describe, expect, it } from 'vitest';
import { previewAsked } from '#/features/branding/service/preview';

describe('previewAsked', () => {
  it('wants the account only when a preview is framed over a theme that was read', () => {
    expect(previewAsked(true, {})).toBe(true);
    expect(previewAsked(true, undefined)).toBe(false);
    expect(previewAsked(false, {})).toBe(false);
  });
});
