import { writeRefusal } from '#/shared/service/capabilities';
import { writeFailureText } from '#/shared/service/failure.ts';
import { counted } from '#/shared/service/format.ts';
import type { GatewayFailure } from '#/shared/service/result.ts';

export const ASSIGNMENTS: readonly { id: string; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'optional', label: 'Optional' },
];

export const ASSIGNMENT_RULE =
  'A default scope goes to a request that names no scope. An optional scope goes only to a request that names it.';

export function assignmentOf(value: string): 'default' | 'optional' {
  return value === 'optional' ? 'optional' : 'default';
}

export function assignedText(scope: string, client: string, assignment: string): string {
  return `${scope} is assigned to ${client} as ${assignment}.`;
}

export function unassignedText(scope: string, client: string): string {
  return `${scope} is no longer assigned to ${client}.`;
}

export function clientsCount(shown: number, more: boolean): string {
  return more
    ? `${String(shown)} ${shown === 1 ? 'client' : 'clients'} shown, with more to load.`
    : `${counted(shown, 'client', 'clients')}.`;
}

// A lost answer is never sent again; the list says whether it took.
export function clientAssignmentFailure(
  failure: GatewayFailure,
  scope: string,
  client: string,
  verb: 'assigned' | 'unassigned',
): string {
  return writeFailureText(failure, {
    name: `${scope} for ${client}`,
    verb,
    lookAt: "the scope's clients",
    refused: (problem) => writeRefusal(problem),
  });
}

// A client as the console holds it after an assignment changed its scopes.
export function withScopes<S, C extends { scopes: readonly S[] }>(
  client: C,
  scopes: readonly S[],
): C {
  return { ...client, scopes };
}

export function withoutScope<C extends { scopes: readonly { id: string }[] }>(
  client: C,
  scopeId: string,
): C {
  return { ...client, scopes: client.scopes.filter((scope) => scope.id !== scopeId) };
}

// Whoami has answered and names no capability missing for the client search.
export function clientsOffered(known: boolean, needs: readonly string[]): boolean {
  return known && needs.length === 0;
}

export function chosenClient<C extends { id: string }>(
  options: readonly C[],
  id: string | null,
): C | null {
  return options.find((option) => option.id === id) ?? null;
}
