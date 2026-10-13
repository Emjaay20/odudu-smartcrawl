import type { ClientScope, Role, SetScopeRolesResponse } from '@odudu/contracts/admin';
import { useAuthority, useRefusal } from '#/features/session';
import { useScopeRolesRecord, useScopeSaves } from '#/features/scopes/repository/useScopeRecord';
import { keptRoles, scopeRoleUnavailable, scopeRolesRecord } from '#/features/scopes/service';
import type { RecordState } from '#/shared/repository/useRecord';
import { useRolePicker } from '#/shared/repository/useRolePicker';
import { useSectionSave, type SectionSave } from '#/shared/repository/useSectionSave';
import { writeRefusal } from '#/shared/service/capabilities';
import { describeIds } from '#/shared/service/format';
import { sortedIds } from '#/shared/service/ids';
import type { PickerState } from '#/shared/service/picker';
import type { RoleValues } from '#/shared/service/sectionValues';
import { type MappedRole, mappedRoles, roleIndex, withKept } from '#/shared/service/mappedRoles';

export function useScopeRolesRead(tenant: string, id: string): RecordState<SetScopeRolesResponse> {
  return useScopeRolesRecord(tenant, id);
}

export interface ScopeRoles {
  save: SectionSave<RoleValues>;
  // Whether the picker is offered: what the ceiling needs has been read.
  offered: boolean;
  picker: PickerState<Role>;
  unavailableOf: (role: Role) => string | null;
  choose: (ids: readonly string[]) => void;
  mapped: readonly MappedRole[];
  // Mapped roles this caller may not take away, each kept by every save.
  kept: readonly string[];
}

export function useScopeRoles({
  tenant,
  scope,
  data,
  etag,
  gone,
}: {
  tenant: string;
  scope: ClientScope;
  data: SetScopeRolesResponse;
  etag: string;
  gone: boolean;
}): ScopeRoles {
  const refusal = useRefusal(tenant);
  const authority = useAuthority(tenant);
  const picker = useRolePicker(tenant);
  const saves = useScopeSaves(tenant, scope.id);
  const known = roleIndex(data.items, picker.options);
  const caller = authority?.capabilities ?? [];
  const kept = keptRoles(
    data.items.map((role) => role.id),
    known,
    caller,
    tenant,
  );
  const save = useSectionSave({
    tenant,
    record: scopeRolesRecord(scope.id),
    section: 'roles',
    label: 'Roles',
    etag,
    capability: 'manage-tenant',
    gone,
    refusal,
    explain: writeRefusal,
    fields: {
      role_ids: {
        value: sortedIds(data.items.map((role) => role.id)),
        label: 'Roles',
        kind: 'plain',
        describe: (value) => describeIds(value, (id) => known.get(id)?.name ?? id),
      },
    },
    save: saves.roles,
  });
  return {
    save,
    offered: authority !== undefined,
    picker,
    unavailableOf: (role) => scopeRoleUnavailable(role, caller, tenant),
    choose: (ids) => {
      save.edit('role_ids', withKept(ids, kept));
    },
    mapped: mappedRoles(save.values.role_ids, known),
    kept,
  };
}
