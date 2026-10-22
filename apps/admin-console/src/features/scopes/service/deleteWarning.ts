import type { ScopeImpact } from '@odudu/contracts/admin';
import { scopeDeleteConsequence } from '#/features/scopes/service/guard';
import { andList, plural } from '#/shared/service/format';
import type { Read } from '#/shared/service/read';

interface Count {
  count: number;
  capped: boolean;
}

export type Impact =
  | { kind: 'reading' }
  | { kind: 'unknown' }
  | { kind: 'counted'; builtin: boolean; clients: Count; roles: Count };

// From the impact read alone: a count that could not be read is never none.
export function impactOf(read: Read<ScopeImpact>): Impact {
  if (read.status === 'loading') return { kind: 'reading' };
  if (read.status === 'failed') return { kind: 'unknown' };
  return {
    kind: 'counted',
    builtin: read.data.builtin,
    clients: read.data.client_assignments,
    roles: read.data.role_mappings,
  };
}

// While nothing is bound, issuance runs the mappers that declare the scope.
export function claimMappersOf(
  read: { bound: readonly string[]; declared: readonly string[] } | undefined,
): readonly string[] {
  if (read === undefined) return [];
  return read.bound.length > 0 ? read.bound : read.declared;
}

function shown({ count, capped }: Count): string {
  const n = count.toLocaleString('en-US');
  return capped ? `${n} or more` : n;
}

function clientsText(name: string, clients: Count): string {
  if (clients.count === 0 && !clients.capped) {
    return `No client carries ${name}, so no client stops receiving its claims.`;
  }
  const many = clients.capped || clients.count !== 1;
  return `${shown(clients)} ${many ? 'clients carry' : 'client carries'} ${name} and will stop receiving its claims.`;
}

function rolesText(roles: Count): string {
  if (roles.count === 0 && !roles.capped) return 'No role is mapped to it.';
  const many = roles.capped || roles.count !== 1;
  return `${shown(roles)} ${many ? 'roles are' : 'role is'} mapped to it and will be unmapped.`;
}

function builtinText(name: string): string {
  return `${name} is a built-in scope, which every tenant has. Restore built-in scopes on the scopes list creates it again, without the clients and roles it had.`;
}

function impactText(name: string, impact: Impact): string {
  switch (impact.kind) {
    case 'reading':
      return `Counting the clients that carry ${name} and the roles mapped to it. Every client will stop receiving its claims and every role will be unmapped.`;
    case 'unknown':
      return `How many clients carry ${name}, and how many roles are mapped to it, could not be read. Every one of them goes with it.`;
    case 'counted': {
      const counts = `${clientsText(name, impact.clients)} ${rolesText(impact.roles)}`;
      return impact.builtin ? `${counts} ${builtinText(name)}` : counts;
    }
  }
}

// `mappers` is empty when none is known, and the claims are then not named.
export function scopeDeleteWarning(
  name: string,
  impact: Impact,
  mappers: readonly string[],
): string {
  const text = impactText(name, impact);
  if (mappers.length === 0) return text;
  return `${text} Its claims come from the ${andList(mappers)} ${plural(mappers.length, 'mapper', 'mappers')}.`;
}

export function scopeDeleteDialogText(
  name: string,
  impact: Impact,
  mappers: readonly string[],
): string {
  return `${scopeDeleteWarning(name, impact, mappers)} ${scopeDeleteConsequence(name)}`;
}
