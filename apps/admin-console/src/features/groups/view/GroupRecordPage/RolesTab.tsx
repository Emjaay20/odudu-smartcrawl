import type { GroupRecord } from '@odudu/contracts/admin';
import {
  useGroupRoles,
  useGroupRolesRead,
  type GroupRoles,
} from '#/features/groups/usecase/useGroupRoles';
import type { Ceiling } from '#/features/groups/usecase/useGroupRecordPage';
import { AskedDialog } from '#/shared/view/ConfirmDialog';
import { MappedRoles } from '#/shared/view/MappedRoles';
import { ReadGate } from '#/shared/view/ReadGate';
import { RolePicker } from '#/shared/view/RolePicker';
import { SaveSection } from '#/shared/view/SaveSection';
import { recordTab } from '#/shared/view/RecordTab';

function Roles({ path, roles }: { path: string; roles: GroupRoles }) {
  const s = roles.save;
  return (
    <SaveSection
      title="Roles"
      description={`Every role here is held by each member of ${path} and of every group beneath it.`}
      save={s}
    >
      <MappedRoles name={path} mapped={roles.mapped} />
      {roles.offered ? (
        <RolePicker
          label={`Roles ${path} carries`}
          picker={roles.picker}
          selected={s.values.role_ids}
          unavailableOf={roles.unavailableOf}
          onChange={roles.choose}
        />
      ) : (
        <p className={recordTab.rule}>Checking what you may give or take here…</p>
      )}
      {roles.kept.length === 0 ? null : (
        <p className={recordTab.rule}>
          A role you could not give is one you cannot take away either, so it stays whatever else is
          saved.
        </p>
      )}
      <AskedDialog
        asked={roles.asking}
        confirmLabel="Save Roles"
        onConfirm={roles.confirm}
        onCancel={roles.cancel}
      />
    </SaveSection>
  );
}

function Ready({
  tenant,
  group,
  ceiling,
  ...read
}: {
  tenant: string;
  group: GroupRecord;
  ceiling: Ceiling;
  data: Parameters<typeof useGroupRoles>[0]['data'];
  etag: string;
  gone: boolean;
}) {
  const roles = useGroupRoles({ tenant, group, ceiling, ...read });
  return <Roles path={group.path} roles={roles} />;
}

export function RolesTab({
  tenant,
  group,
  ceiling,
}: {
  tenant: string;
  group: GroupRecord;
  ceiling: Ceiling;
}) {
  const read = useGroupRolesRead(tenant, group.id);
  return (
    <ReadGate
      read={read}
      label="Loading the roles"
      fields={2}
      failed="The roles could not be loaded"
    >
      {(data, etag) => (
        <div className={recordTab.tab}>
          <Ready
            tenant={tenant}
            group={group}
            ceiling={ceiling}
            data={data}
            etag={etag}
            gone={read.gone}
          />
        </div>
      )}
    </ReadGate>
  );
}
