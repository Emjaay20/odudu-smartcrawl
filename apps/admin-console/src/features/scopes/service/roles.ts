import { roleReachUnavailable } from '#/shared/service/capabilities';
import type { IndexedRole } from '#/shared/service/mappedRoles';
import type { AdminCapability } from '#/shared/service/principal';

export function scopeRoleUnavailable(
  role: { name: string; client_key: string | null; admin_reach: readonly string[] },
  caller: readonly AdminCapability[],
  tenant: string,
): string | null {
  return roleReachUnavailable(role, caller, tenant);
}

// A mapped role the caller could not give is one it cannot take.
export function keptRoles(
  mapped: readonly string[],
  index: ReadonlyMap<string, IndexedRole>,
  caller: readonly AdminCapability[],
  tenant: string,
): string[] {
  return mapped.filter((id) => {
    const found = index.get(id);
    return found !== undefined && scopeRoleUnavailable(found, caller, tenant) !== null;
  });
}
