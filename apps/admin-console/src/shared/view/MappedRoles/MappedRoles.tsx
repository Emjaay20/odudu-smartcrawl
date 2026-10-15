import type { MappedRole } from '#/shared/service/mappedRoles';
import { recordTab } from '#/shared/view/RecordTab';
import { RoleOwner } from '#/shared/view/RoleOwner';

// The roles a group or a scope hands on, each told apart by whose it is.
export function MappedRoles({ name, mapped }: { name: string; mapped: readonly MappedRole[] }) {
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
