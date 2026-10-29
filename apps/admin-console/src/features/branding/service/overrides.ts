import {
  MESSAGE_OVERRIDE_LIMIT,
  MESSAGE_OVERRIDE_MAX_LENGTH,
  type FieldError,
  type MessageOverride,
} from '@odudu/contracts/admin';
import { writeRefusal } from '#/shared/service/capabilities';
import { removalOutcome, writeFailureText, type RemovalOutcome } from '#/shared/service/failure';
import { fieldErrorsOf } from '#/shared/service/fieldErrors';
import { counted } from '#/shared/service/format';
import type { GatewayFailure, GatewayResult, Problem } from '#/shared/service/result';

export const OVERRIDES_TITLE = 'Message overrides';

export const OVERRIDES_DESCRIPTION =
  'The tenant’s own wording for the messages its pages show, per language. A language with no override shows the catalogue’s text. Mail is not changed by these.';

export const OVERRIDE_CAP = MESSAGE_OVERRIDE_LIMIT;

export const OVERRIDE_LENGTH = MESSAGE_OVERRIDE_MAX_LENGTH;

export const KEY_LABEL = 'Message key';

export const KEY_NOTE =
  'The key of the page message to replace, such as login.title. The server holds the list, so a key it does not know is refused.';

export const MESSAGE_LABEL = 'Text shown instead';

export const OVERRIDE_MESSAGE_NOTE =
  'Keep placeholders such as {name} as the catalogue writes them. Markup is shown as text.';

export const OVERRIDE_LOCALE_LABEL = 'Language';

export const SAVE_OVERRIDE = 'Save override';

export const EDIT_HINT = 'Editing an override replaces its text.';

export const NOTHING_YET = 'No message has been overridden in this language.';

export const NOUN = { one: 'override', other: 'overrides' } as const;

// What the console says in place of the server's field messages: the server
// names a path, the console says what to do about it.
export const UNKNOWN_KEY =
  'That is not the key of any page message. Keys look like login.title, and the catalogue is in English.';

export const OVER_BOUND = `The tenant already has ${String(OVERRIDE_CAP)} message overrides, the most it may hold. Remove one first; changing an override that exists is always allowed.`;

export const KEY_REQUIRED = 'Enter the key of the message to override.';

export const MESSAGE_REQUIRED = 'Enter the text to show instead.';

export interface OverrideValues {
  key: string;
  message: string;
}

export type OverrideErrors = Partial<Record<keyof OverrideValues, string>>;

export const EMPTY_OVERRIDE: OverrideValues = { key: '', message: '' };

export function overrideProblems(values: OverrideValues): OverrideErrors {
  const key = values.key.trim();
  return {
    ...(key === '' ? { key: KEY_REQUIRED } : {}),
    ...(key.length > 128 ? { key: 'A key is at most 128 characters.' } : {}),
    ...(values.message === '' ? { message: MESSAGE_REQUIRED } : {}),
    ...(values.message.length > OVERRIDE_LENGTH
      ? { message: `The text is at most ${String(OVERRIDE_LENGTH)} characters.` }
      : {}),
  };
}

export function hasProblems(errors: OverrideErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function clearedOverrideError(
  errors: OverrideErrors,
  field: keyof OverrideValues,
): OverrideErrors {
  return Object.fromEntries(Object.entries(errors).filter(([name]) => name !== field));
}

function typeOf(problem: Problem): string {
  return problem.type.split('#')[1] ?? '';
}

function unknownKey(errors: readonly FieldError[] | undefined): boolean {
  return errors?.some((error) => error.path === 'key') === true;
}

export interface OverrideOutcome {
  errors: OverrideErrors;
  message: string | null;
  // A refusal for lack of a capability: whoami may have changed.
  report: boolean;
}

const NO_OUTCOME: OverrideOutcome = { errors: {}, message: null, report: false };

function problemOutcome(problem: Problem): OverrideOutcome {
  if (problem.status === 409 && typeOf(problem) === 'message-overrides-full') {
    return { ...NO_OUTCOME, message: OVER_BOUND };
  }
  if (problem.status === 400 && unknownKey(problem.errors)) {
    return { ...NO_OUTCOME, errors: { key: UNKNOWN_KEY } };
  }
  const refused = writeRefusal(problem, 'manage-tenant');
  if (refused !== null) return { ...NO_OUTCOME, message: refused, report: true };
  const placed = fieldErrorsOf(problem, ['message']);
  return {
    ...NO_OUTCOME,
    errors: placed.fields,
    message: placed.other.length === 0 ? null : placed.other.join(' '),
  };
}

// What a failed write of an override says, placed on the field it concerns.
export function overrideFailure(failure: GatewayFailure): OverrideOutcome {
  if (failure.kind === 'problem') return problemOutcome(failure.problem);
  return {
    ...NO_OUTCOME,
    message: writeFailureText(failure, {
      name: 'The override',
      verb: 'saved',
      lookAt: 'the list',
    }),
  };
}

export function savedText(locale: string, key: string): string {
  return `The ${locale} text for ${key} was saved.`;
}

export const REMOVED_TEXT = 'The override was removed. The page shows the catalogue’s text again.';

export const ALREADY_REMOVED = 'That override is already gone. The list is read again.';

export function removeConsequence(override: Pick<MessageOverride, 'locale' | 'key'>): string {
  return `Pages in ${override.locale} show the catalogue’s text for ${override.key} again. Other languages are not affected.`;
}

export function askedRemoval(asked: Pick<MessageOverride, 'locale' | 'key'> | null): string {
  return asked === null ? '' : removeConsequence(asked);
}

export function removeOutcome(result: GatewayResult<unknown>): RemovalOutcome {
  return removalOutcome(
    result,
    { doneText: REMOVED_TEXT, alreadyGoneText: ALREADY_REMOVED },
    {
      name: 'The override',
      verb: 'removed',
      lookAt: 'the list',
      refused: (problem) => writeRefusal(problem, 'manage-tenant'),
    },
  );
}

export function capText(held: number): string {
  return `${counted(held, 'override', 'overrides')} in this language; the tenant may hold ${String(OVERRIDE_CAP)} across every language.`;
}

// The page size of the table; the server pages at most 200.
export const PAGE_SIZE = 50;

export interface SaveOutcome {
  errors: OverrideErrors;
  message: string | null;
  report: boolean;
  // What the form holds afterwards: empty once saved, as it was otherwise.
  values: OverrideValues;
  toast: string | null;
}

export function saveOutcome(
  result: GatewayResult<unknown>,
  sent: { locale: string; key: string },
  values: OverrideValues,
): SaveOutcome {
  if (result.ok) {
    return {
      ...NO_OUTCOME,
      values: EMPTY_OVERRIDE,
      toast: savedText(sent.locale, sent.key),
    };
  }
  return { ...overrideFailure(result), values, toast: null };
}

// The language the table shows: the one picked while it is still offered.
export function shownLocale(
  picked: string | null,
  supported: readonly string[],
  opening: string,
): string {
  return picked !== null && supported.includes(picked) ? picked : opening;
}
