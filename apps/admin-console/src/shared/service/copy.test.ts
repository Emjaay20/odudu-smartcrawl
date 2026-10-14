import { describe, expect, it } from 'vitest';
import { copiedDescription, copyBlocked, copyBusy } from '#/shared/service/copy';

it('shows the description edited, else the source one', () => {
  expect(copiedDescription('mine', 'Reads')).toBe('mine');
  expect(copiedDescription('', 'Reads')).toBe('');
  expect(copiedDescription(null, 'Reads')).toBe('Reads');
  expect(copiedDescription(null, null)).toBe('');
});

describe('what holds a copy back', () => {
  const partial = { text: 't', href: '/h', name: 'n' };

  it('is busy while a write is under way, the source is read, or the caller is not known', () => {
    expect(copyBusy(false, 'ready', ['view-users'])).toBe(false);
    expect(copyBusy(true, 'ready', [])).toBe(true);
    expect(copyBusy(false, 'loading', [])).toBe(true);
    expect(copyBusy(false, 'none', undefined)).toBe(true);
    expect(copyBusy(false, 'failed', [])).toBe(false);
  });
  it('is blocked for the same, and for a copy part-made that stays on the page', () => {
    expect(copyBlocked(false, null, 'ready', [])).toBe(false);
    expect(copyBlocked(false, partial, 'ready', [])).toBe(true);
    expect(copyBlocked(true, null, 'ready', [])).toBe(true);
    expect(copyBlocked(false, null, 'loading', [])).toBe(true);
    expect(copyBlocked(false, null, 'none', undefined)).toBe(true);
  });
});
