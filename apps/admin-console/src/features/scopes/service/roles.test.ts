import type { Role } from '@odudu/contracts/admin';
import { expect, it } from 'vitest';
import {
  keptRoles,
  roleIndex,
  scopeRoleRows,
  scopeRoleUnavailable,
  withKept,
} from '#/features/scopes/service';

const READER = {
  id: 'r1',
  name: 'reader',
  client_id: null,
  client_key: null,
  admin_reach: [] as Role['admin_reach'],
};
const KEYS = {
  id: 'r2',
  name: 'keeper',
  client_id: null,
  client_key: null,
  admin_reach: ['manage-keys'] as Role['admin_reach'],
};

it('makes a role unavailable when it reaches what the caller does not hold', () => {
  expect(scopeRoleUnavailable(READER, ['view-users'], 'acme')).toBeNull();
  expect(scopeRoleUnavailable(KEYS, ['view-users'], 'acme')).toMatch(/manage-keys/u);
});

it('keeps a mapped role the caller could not give, though the picker has not loaded it', () => {
  const index = roleIndex([READER, KEYS], []);
  expect(keptRoles(['r1', 'r2'], index, ['view-users'], 'acme')).toEqual(['r2']);
  expect(keptRoles(['r1', 'r2'], index, ['manage-keys'], 'acme')).toEqual([]);
  expect(withKept(['r1'], ['r2'])).toEqual(['r1', 'r2']);
});

it('takes a picker role over the mapped one, for its description', () => {
  const picked: Role = {
    ...READER,
    description: 'Reads',
    default_for_new_subjects: false,
    created_at: '2026-09-28T08:41:53.858Z',
  };
  const index = roleIndex([READER], [picked]);
  expect(scopeRoleRows(['r1'], index)).toEqual([
    { id: 'r1', name: 'reader', client_id: null, client_key: null, description: 'Reads' },
  ]);
});

it('names a role it has no record of by its id, owner unknown, and keeps nothing for it', () => {
  const index = roleIndex([], []);
  expect(scopeRoleRows(['r8'], index)).toEqual([
    { id: 'r8', name: 'r8', client_id: null, client_key: null, description: null },
  ]);
  expect(keptRoles(['r8'], index, [], 'acme')).toEqual([]);
});
