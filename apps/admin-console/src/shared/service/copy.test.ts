import { expect, it } from 'vitest';
import { copiedDescription } from '#/shared/service/copy';

it('shows the description edited, else the source one', () => {
  expect(copiedDescription('mine', 'Reads')).toBe('mine');
  expect(copiedDescription('', 'Reads')).toBe('');
  expect(copiedDescription(null, 'Reads')).toBe('Reads');
  expect(copiedDescription(null, null)).toBe('');
});
