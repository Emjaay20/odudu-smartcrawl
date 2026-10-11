import type { Role, SetScopeRolesResponse } from '@odudu/contracts/admin';
import { roleReachUnavailable } from '#/shared/service/capabilities';
import { sortedIds } from '#/shared/service/ids.ts';
import type { AdminCapability } from '#/shared/service/principal.ts';

type MappedItem = SetScopeRolesResponse['items'][number];

export interface ScopeRole {
  id: string;
  name: string;
  client_id: string | null;
  client_key: string | null;
  description: string | null;
}

export function scopeRoleUnavailable(
  role: { name: string; client_key: string | null; admin_reach: readonly string[] },
  caller: readonly AdminCapability[],
  tenant: string,
): string | null {
  return roleReachUnavailable(role, caller, tenant);
}

type Known = ScopeRole & { admin_reach: readonly string[] };

// The mapped roles, which carry no description, and then the picker's roles,
// which do and so win.
export function roleIndex(
  items: readonly MappedItem[],
  options: readonly Role[],
): ReadonlyMap<string, Known> {
  const entry = (role: MappedItem | Role): [string, Known] => [
    role.id,
    {
      id: role.id,
      name: role.name,
      client_id: role.client_id,
      client_key: role.client_key,
      description: 'description' in role ? role.description : null,
      admin_reach: role.admin_reach,
    },
  ];
  return new Map([...items.map(entry), ...options.map(entry)]);
}

export function scopeRoleRows(
  ids: readonly string[],
  index: ReadonlyMap<string, Known>,
): ScopeRole[] {
  return ids.map((id) => {
    const found = index.get(id);
    return found === undefined
      ? { id, name: id, client_id: null, client_key: null, description: null }
      : {
          id,
          name: found.name,
          client_id: found.client_id,
          client_key: found.client_key,
          description: found.description,
        };
  });
}

// A mapped role the caller could not give is one it cannot take.
export function keptRoles(
  mapped: readonly string[],
  index: ReadonlyMap<string, Known>,
  caller: readonly AdminCapability[],
  tenant: string,
): string[] {
  return mapped.filter((id) => {
    const found = index.get(id);
    return found !== undefined && scopeRoleUnavailable(found, caller, tenant) !== null;
  });
}

export function withKept(ids: readonly string[], kept: readonly string[]): string[] {
  return sortedIds([...new Set([...ids, ...kept])]);
}
