import type { FieldError } from '@odudu/contracts/admin';
import type { GatewayResult } from '#/shared/service/result';
import type { LineIssue } from '#/shared/service/code';
import { counted } from '#/shared/service/format';

// The most refusals of one piece marked and listed at once; the server stops
// at 100.
export const PLACED_SHOWN = 20;

export interface PlacedProblems {
  // The refusals that name a line, to mark on it.
  lines: LineIssue[];
  // What shows under the editor; undefined when nothing is wrong.
  message: string | undefined;
}

export const NO_PROBLEMS: PlacedProblems = { lines: [], message: undefined };

// A refusal's own words with what it quoted of the text, when it quoted any.
export function detailed(text: string, error: FieldError): string {
  return error.detail === undefined || error.detail === '' ? text : `${text} (${error.detail})`;
}

// What a refused save says about one piece of the theme. `saved` is what the
// save's own machinery made of the refusal; it stands when the refusal has
// none of its own to read, and when it is undefined nothing is wrong.
export function placedProblems(
  errors: readonly FieldError[],
  saved: string | undefined,
  { path, refused, wording }: { path: string; refused: string; wording: (e: FieldError) => string },
): PlacedProblems {
  if (saved === undefined) return NO_PROBLEMS;
  const own = errors.filter((error) => error.path === path);
  if (own.length === 0) return { lines: [], message: saved };
  const shown = own.slice(0, PLACED_SHOWN);
  const placed = shown.filter((error) => typeof error.line === 'number');
  const rest = own.length - shown.length;
  const sentences = [
    refused,
    ...shown.filter((error) => typeof error.line !== 'number').map(wording),
    ...(rest > 0 ? [`And ${counted(rest, 'more problem', 'more problems')}.`] : []),
  ];
  return {
    lines: placed.map((error) => ({ line: error.line ?? 1, text: wording(error) })),
    message: sentences.join(' '),
  };
}

// The refusals a save's answer carries, for an editor to place on lines;
// none once a save has gone through.
export function refusalErrors(result: GatewayResult<unknown>): readonly FieldError[] {
  return !result.ok && result.kind === 'problem' ? (result.problem.errors ?? []) : [];
}
