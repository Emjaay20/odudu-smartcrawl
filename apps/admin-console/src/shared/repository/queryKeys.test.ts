import { expect, it } from 'vitest';
import {
  countKey,
  GROUP_KIND,
  groupKey,
  heldCapabilitiesKey,
  holdersKey,
  listKey,
  overviewKey,
  pickerKey,
  recordKey,
  scopeClientsKey,
} from '#/shared/repository/queryKeys';

it('names every kind of cached read by its kind, its tenant and what it reads', () => {
  expect(listKey('acme', 'roles')).toEqual(['list', 'acme', 'roles']);
  expect(listKey('acme', 'groups', 'children', 'g1')).toEqual([
    'list',
    'acme',
    'groups',
    'children',
    'g1',
  ]);
  expect(countKey('acme', 'roles', 'name=a')).toEqual(['count', 'acme', 'roles', 'name=a']);
  expect(pickerKey('acme', 'roles')).toEqual(['picker', 'acme', 'roles']);
  expect(recordKey('acme', 'clients/c1')).toEqual(['record', 'acme', 'clients/c1']);
  expect(holdersKey('acme', 'enabled', 'any')).toEqual(['holders', 'acme', 'enabled', 'any']);
  expect(heldCapabilitiesKey('acme', 's1')).toEqual(['held-capabilities', 'acme', 's1']);
  expect(scopeClientsKey('acme', 'sc1')).toEqual(['scope-clients', 'acme', 'sc1']);
  expect(overviewKey('acme', 'keys')).toEqual(['overview', 'acme', 'keys']);
  expect(groupKey('acme', 'g1')).toEqual(['group', 'acme', 'g1']);
  expect(GROUP_KIND).toBe('group');
});

it('is a prefix of what it names when given no more than the tenant', () => {
  expect(listKey('acme')).toEqual(['list', 'acme']);
  expect(countKey('acme')).toEqual(['count', 'acme']);
  expect(holdersKey('acme')).toEqual(['holders', 'acme']);
  expect(heldCapabilitiesKey('acme')).toEqual(['held-capabilities', 'acme']);
  expect(overviewKey('acme')).toEqual(['overview', 'acme']);
});
