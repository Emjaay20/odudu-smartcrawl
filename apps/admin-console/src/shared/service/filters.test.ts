import { expect, it } from 'vitest';
import { optionalFilter } from '#/shared/service/filters';

it('sends a filter only when it names something', () => {
  expect(optionalFilter('status', 'failed')).toEqual({ status: 'failed' });
  expect(optionalFilter('status', null)).toEqual({});
  expect(optionalFilter('client', undefined)).toEqual({});
});
