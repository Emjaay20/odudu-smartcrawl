import type { ClientScope } from '@odudu/contracts/admin';
import {
  useScopeRoles,
  useScopeRolesRead,
  type ScopeRoles,
} from '#/features/scopes/usecase/useScopeRoles';
import type { MappedRole } from '#/shared/service/mappedRoles';
import { ReadGate } from '#/shared/view/ReadGate';
import { RoleOwner } from '#/shared/view/RoleOwner';
import { RolePicker } from '#/shared/view/RolePicker';
import { SaveSection } from '#/shared/view/SaveSection';
import { recordTab } from '#/shared/view/RecordTab';

function Listed({ name, mapped }: { name: string; mapped: readonly MappedRole[] }) {
  if (mapped.length === 0) return <p className={recordTab.rule}>{`${name} carries no role.`}</p>;
  return (
    <ul aria-label={`Carried by ${name}`} className={recordTab.items}>
      {mapped.map((role) => (
        <li key={role.id}>
          <code>{role.name}</code> <RoleOwner role={role} />
          {role.description === null || role.description === '' ? null : (
            <span className={recordTab.rule}>{` ${role.description}`}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Roles({ name, roles }: { name: string; roles: ScopeRoles }) {
  const s = roles.save;
  return (
    <SaveSection
      title="Roles"
      description={`A token granted ${name} carries these roles' claims.`}
      save={s}
    >
      <Listed name={name} mapped={roles.mapped} />
      {roles.offered ? (
        <RolePicker
          label={`Roles ${name} carries`}
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
    </SaveSection>
  );
}

function Ready({
  tenant,
  scope,
  ...read
}: {
  tenant: string;
  scope: ClientScope;
  data: Parameters<typeof useScopeRoles>[0]['data'];
  etag: string;
  gone: boolean;
}) {
  const roles = useScopeRoles({ tenant, scope, ...read });
  return <Roles name={scope.name} roles={roles} />;
}

export function RolesTab({ tenant, scope }: { tenant: string; scope: ClientScope }) {
  const read = useScopeRolesRead(tenant, scope.id);
  return (
    <ReadGate
      read={read}
      label="Loading the roles"
      fields={2}
      failed="The roles could not be loaded"
    >
      {(data, etag) => (
        <div className={recordTab.tab}>
          <Ready tenant={tenant} scope={scope} data={data} etag={etag} gone={read.gone} />
        </div>
      )}
    </ReadGate>
  );
}
