import { scopeDeleteConsequence } from '#/features/scopes/service/guard';
import { andList } from '#/shared/service/format';
import type { ListStatus } from '#/shared/service/resourceList';

export type Carrying =
  { kind: 'reading' } | { kind: 'counted'; shown: number; more: boolean } | { kind: 'unknown' };

// From the first page of the clients that carry the scope, and nothing more.
export function carryingOf(status: ListStatus, shown: number, more: boolean): Carrying {
  if (status === 'loading') return { kind: 'reading' };
  if (status !== 'ready') return { kind: 'unknown' };
  return { kind: 'counted', shown, more };
}

// While nothing is bound, issuance runs the mappers that declare the scope.
export function claimMappersOf(
  read: { bound: readonly string[]; declared: readonly string[] } | undefined,
): readonly string[] {
  if (read === undefined) return [];
  return read.bound.length > 0 ? read.bound : read.declared;
}

function carryingText(name: string, carrying: Carrying): string {
  switch (carrying.kind) {
    case 'reading':
      return `Counting the clients that carry ${name}. Every one of them will stop receiving its claims.`;
    case 'unknown':
      return `How many clients carry ${name} could not be read. Every client that does will stop receiving its claims.`;
    case 'counted': {
      if (carrying.shown === 0 && !carrying.more) {
        return `No client carries ${name}, so no client stops receiving its claims.`;
      }
      const n = carrying.more ? `${String(carrying.shown)} or more` : String(carrying.shown);
      const plural = carrying.more || carrying.shown !== 1;
      return `${n} ${plural ? 'clients carry' : 'client carries'} ${name} and will stop receiving its claims.`;
    }
  }
}

// `mappers` is empty when none is known, and the claims are then not named.
export function scopeDeleteWarning(
  name: string,
  carrying: Carrying,
  mappers: readonly string[],
): string {
  const text = carryingText(name, carrying);
  if (mappers.length === 0) return text;
  return `${text} Its claims come from the ${andList(mappers)} ${mappers.length === 1 ? 'mapper' : 'mappers'}.`;
}

export function scopeDeleteDialogText(
  name: string,
  carrying: Carrying,
  mappers: readonly string[],
): string {
  return `${scopeDeleteWarning(name, carrying, mappers)} ${scopeDeleteConsequence(name)}`;
}
