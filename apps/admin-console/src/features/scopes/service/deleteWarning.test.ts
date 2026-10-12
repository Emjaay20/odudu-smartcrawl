import { expect, it } from 'vitest';
import {
  carryingOf,
  claimMappersOf,
  scopeDeleteDialogText,
  scopeDeleteWarning,
} from '#/features/scopes/service';

it('judges the clients a first page shows: counted, open-ended, unknown or not yet read', () => {
  expect(carryingOf('ready', 0, false)).toEqual({ kind: 'counted', shown: 0, more: false });
  expect(carryingOf('ready', 25, true)).toEqual({ kind: 'counted', shown: 25, more: true });
  expect(carryingOf('refused', 0, false)).toEqual({ kind: 'unknown' });
  expect(carryingOf('failed', 0, false)).toEqual({ kind: 'unknown' });
  expect(carryingOf('loading', 0, false)).toEqual({ kind: 'reading' });
});

it('names the bound mappers, else the declared ones, else none', () => {
  expect(claimMappersOf({ bound: ['groups'], declared: ['email'] })).toEqual(['groups']);
  expect(claimMappersOf({ bound: [], declared: ['email'] })).toEqual(['email']);
  expect(claimMappersOf({ bound: [], declared: [] })).toEqual([]);
  expect(claimMappersOf(undefined)).toEqual([]);
});

it('says no client carries the scope when none does', () => {
  expect(scopeDeleteWarning('billing', { kind: 'counted', shown: 0, more: false }, [])).toBe(
    'No client carries billing, so no client stops receiving its claims.',
  );
});

it('says how many clients stop receiving its claims, one or many', () => {
  expect(scopeDeleteWarning('billing', { kind: 'counted', shown: 1, more: false }, [])).toBe(
    '1 client carries billing and will stop receiving its claims.',
  );
  expect(scopeDeleteWarning('billing', { kind: 'counted', shown: 3, more: false }, [])).toBe(
    '3 clients carry billing and will stop receiving its claims.',
  );
});

it('says "or more" when the first page was not the whole list', () => {
  expect(scopeDeleteWarning('billing', { kind: 'counted', shown: 25, more: true }, [])).toBe(
    '25 or more clients carry billing and will stop receiving its claims.',
  );
});

it('never turns an unreadable count into none', () => {
  const text = scopeDeleteWarning('billing', { kind: 'unknown' }, []);
  expect(text).toBe(
    'How many clients carry billing could not be read. Every client that does will stop receiving its claims.',
  );
  expect(text).not.toMatch(/\bNo client\b|\b0\b/u);
});

it('says the count is being read while it is', () => {
  expect(scopeDeleteWarning('billing', { kind: 'reading' }, [])).toBe(
    'Counting the clients that carry billing. Every one of them will stop receiving its claims.',
  );
});

it('names the mappers that produce its claims, where the set is known', () => {
  const counted = { kind: 'counted', shown: 2, more: false } as const;
  expect(scopeDeleteWarning('groups', counted, ['groups'])).toBe(
    '2 clients carry groups and will stop receiving its claims. Its claims come from the groups mapper.',
  );
  expect(scopeDeleteWarning('profile', counted, ['name', 'email'])).toBe(
    '2 clients carry profile and will stop receiving its claims. Its claims come from the name and email mappers.',
  );
  expect(scopeDeleteWarning('x', { kind: 'unknown' }, ['groups'])).toMatch(
    /Its claims come from the groups mapper\.$/u,
  );
});

it('puts the warning before what a delete takes with it', () => {
  const text = scopeDeleteDialogText('billing', { kind: 'counted', shown: 2, more: false }, []);
  expect(text).toMatch(
    /^2 clients carry billing and will stop receiving its claims\. Deleting billing takes it off/u,
  );
});
