import { sortedIds } from '#/shared/service/ids';

export interface MappedRole {
  id: string;
  name: string;
  client_id: string | null;
  client_key: string | null;
  description: string | null;
}

export type IndexedRole = MappedRole & { admin_reach: readonly string[] };

interface Reaching {
  id: string;
  name: string;
  client_id: string | null;
  client_key: string | null;
  admin_reach: readonly string[];
}

// The mapped roles, which carry no description, and then the picker's roles,
// which do and so win.
export function roleIndex(
  items: readonly Reaching[],
  options: readonly (Reaching & { description: string | null })[],
): ReadonlyMap<string, IndexedRole> {
  const entry = (role: Reaching, description: string | null): [string, IndexedRole] => [
    role.id,
    {
      id: role.id,
      name: role.name,
      client_id: role.client_id,
      client_key: role.client_key,
      description,
      admin_reach: role.admin_reach,
    },
  ];
  return new Map([
    ...items.map((role) => entry(role, null)),
    ...options.map((role) => entry(role, role.description)),
  ]);
}

// A role with no record is named by its id, its owner unknown.
export function mappedRoles(
  ids: readonly string[],
  index: ReadonlyMap<string, IndexedRole>,
): MappedRole[] {
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

export function withKept(ids: readonly string[], kept: readonly string[]): string[] {
  return sortedIds([...new Set([...ids, ...kept])]);
}
