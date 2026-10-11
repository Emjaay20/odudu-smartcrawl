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

it('keeps a mapped role that the caller could not give, from what the picker knows of it', () => {
  const index = roleIndex(
    [
      { id: 'r1', name: 'reader', client_id: null, client_key: null },
      { id: 'r2', name: 'keeper', client_id: null, client_key: null },
    ],
    [READER, KEYS].map((role): Role => ({
      ...role,
      description: null,
      default_for_new_subjects: false,
      created_at: '2026-09-28T08:41:53.858Z',
    })),
  );
  expect(keptRoles(['r1', 'r2'], index, ['view-users'], 'acme')).toEqual(['r2']);
  expect(withKept(['r1'], ['r2'])).toEqual(['r1', 'r2']);
});

it('names a mapped role the picker has not loaded by its id, owner unknown', () => {
  const index = roleIndex([{ id: 'r9', name: 'ghost', client_id: null, client_key: null }], []);
  expect(scopeRoleRows(['r9', 'r8'], index)).toEqual([
    { id: 'r9', name: 'ghost', client_id: null, client_key: null, description: null },
    { id: 'r8', name: 'r8', client_id: null, client_key: null, description: null },
  ]);
  expect(keptRoles(['r9'], index, [], 'acme')).toEqual([]);
});
