import { type ScopeImpact } from '@odudu/contracts/admin';

function counted(
  { count, capped }: { count: number; capped: boolean },
  one: string,
  many: string,
): string {
  const shown = count.toLocaleString('en-US');
  if (capped) return `${shown} or more ${many}`;
  return `${shown} ${count === 1 ? one : many}`;
}

/** What a caller is told when it deletes a built-in scope without naming it. */
export function builtinScopeConfirmationDetail(name: string, impact: ScopeImpact): string {
  const clients = counted(impact.client_assignments, 'client', 'clients');
  const roles = counted(impact.role_mappings, 'role', 'roles');
  return (
    `${name} is a built-in scope. Deleting it removes it from ${clients} and unmaps ${roles}, ` +
    `and cannot be undone. Repeat the request with confirm=${name} to delete it.`
  );
}
