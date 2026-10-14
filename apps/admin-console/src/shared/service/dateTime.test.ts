import { describe, expect, it } from 'vitest';
import { edgeOfMinute } from '#/shared/service/dateTime';

describe('the instant a picked minute stands for', () => {
  it('starts at its first millisecond', () => {
    expect(edgeOfMinute('2026-09-28T13:41:37.250Z', 'start')).toBe('2026-09-28T13:41:00.000Z');
  });

  it('ends at its last, so an upper bound that is inclusive takes the whole minute', () => {
    expect(edgeOfMinute('2026-09-28T13:41:00.000Z', 'end')).toBe('2026-09-28T13:41:59.999Z');
  });

  it('is written in UTC whatever offset it was given in', () => {
    expect(edgeOfMinute('2026-09-28T14:41:00+01:00', 'start')).toBe('2026-09-28T13:41:00.000Z');
  });
});
