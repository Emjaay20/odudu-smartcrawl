import { assetPath } from '@odudu/domain-theme';
import { describe, expect, it } from 'vitest';
import { base64Length, usedImages } from '#/service/theme-preview';

const IMAGE = {
  id: 'i',
  sha256: 'a'.repeat(64),
  mime: 'image/png',
  width: 64,
  height: 32,
  size: 300,
};
const PATH = assetPath('acme', IMAGE.sha256, IMAGE.mime) ?? '';

describe('usedImages', () => {
  it('weighs an image once for each place it is written', () => {
    const css = `.a{background:url(${PATH})}`.repeat(5);
    const { used, weight } = usedImages('acme', [IMAGE], [`<img src="${PATH}">`, css]);
    expect(used).toHaveLength(1);
    expect(weight).toBe(base64Length(300) * 6);
  });

  it('leaves out an image nothing names', () => {
    expect(usedImages('acme', [IMAGE], ['<p>none</p>'])).toEqual({ used: [], weight: 0 });
  });
});
