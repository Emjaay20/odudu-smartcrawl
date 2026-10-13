import type { ClientScope } from '@odudu/contracts/admin';
import {
  useScopeRoles,
  useScopeRolesRead,
  type ScopeRoles,
} from '#/features/scopes/usecase/useScopeRoles';
import type { MappedRole } from '#/shared/service/mappedRoles';
import { Button } from '#/shared/view/Button';
import { EmptyState } from '#/shared/view/EmptyState';
import { RoleOwner } from '#/shared/view/RoleOwner';
import { RolePicker } from '#/shared/view/RolePicker';
import { Section } from '#/shared/view/Section';
import { SectionNoticeOf } from '#/shared/view/SectionNoticeOf';
import { FormSkeleton } from '#/shared/view/Skeleton';
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
    <Section
      title="Roles"
      description={`A token granted ${name} carries these roles' claims.`}
      dirty={s.dirty}
      saving={s.saving}
      onSave={s.submit}
      onDiscard={s.discard}
      restored={s.restored}
      blocked={s.blocked}
      notice={<SectionNoticeOf title="Roles" save={s} />}
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
    </Section>
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
  if (read.status === 'loading') return <FormSkeleton label="Loading the roles" fields={2} />;
  if (read.data === undefined || read.etag === null) {
    return (
      <EmptyState
        variant="failed"
        title="The roles could not be loaded"
        action={<Button onPress={read.retry}>Try again</Button>}
      >
        The gateway did not answer, or answered with an error.
      </EmptyState>
    );
  }
  return (
    <div className={recordTab.tab}>
      <Ready tenant={tenant} scope={scope} data={read.data} etag={read.etag} gone={read.gone} />
    </div>
  );
}
