import { roleReachUnavailable } from '#/shared/service/capabilities';
import type { IndexedRole } from '#/shared/service/mappedRoles';
import type { AdminCapability } from '#/shared/service/principal';

// A mapped role the caller could not give is one it cannot take.
export function keptRoles(
  mapped: readonly string[],
  index: ReadonlyMap<string, IndexedRole>,
  caller: readonly AdminCapability[],
  tenant: string,
): string[] {
  return mapped.filter((id) => {
    const found = index.get(id);
    return found !== undefined && roleReachUnavailable(found, caller, tenant) !== null;
  });
}

export const NO_ROLES_MAPPED =
  'No roles mapped. Clients without full scope get no roles from this scope.';
