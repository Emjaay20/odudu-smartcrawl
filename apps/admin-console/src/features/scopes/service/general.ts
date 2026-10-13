import { CONSENT_TEXT_MAX } from '@odudu/contracts/admin';
import type { Choice } from '#/shared/service/choice';

export const CONSENT_RULE = `What the consent screen says in place of the scope's name. At most ${String(CONSENT_TEXT_MAX)} characters; leave it empty for none.`;

export const NAME_FIXED =
  "A scope's name is the token a client asks for and a token carries, so it is fixed once the scope is made. Make a new scope and assign it instead.";

export const ID_TOKEN_LABEL = 'In the ID token';
export const ACCESS_TOKEN_LABEL = 'In the access token';
export const NEW_CLIENT_LABEL = 'For a client made from now on';

export const NEW_CLIENT_CHOICES: readonly Choice[] = [
  { id: 'none', label: 'Not assigned' },
  { id: 'default', label: 'Assigned as default' },
  { id: 'optional', label: 'Assigned as optional' },
];

export function assignmentName(value: unknown): string {
  return NEW_CLIENT_CHOICES.find((choice) => choice.id === value)?.label ?? String(value);
}

const DISPLAY_ORDER_MAX = 2_147_483_647;

// Null when the text is a display order the server accepts.
export function displayOrderProblem(text: string): string | null {
  if (!/^\d+$/u.test(text)) return 'Enter a whole number, zero or more.';
  return Number(text) > DISPLAY_ORDER_MAX ? `Enter at most ${String(DISPLAY_ORDER_MAX)}.` : null;
}

// The consent section's guard: a display order that is not a number holds Save
// and is said under its field once it has been edited, beside what the server
// said of any field and any reason Save was already held.
export function consentGuard(
  order: string,
  changed: readonly string[],
  fieldErrors: Readonly<Partial<Record<string, string>>>,
  blocked: string | undefined,
): { fieldErrors: Readonly<Partial<Record<string, string>>>; blocked: string | undefined } {
  const problem = displayOrderProblem(order);
  return {
    fieldErrors: {
      ...(problem !== null && changed.includes('display_order') ? { display_order: problem } : {}),
      ...fieldErrors,
    },
    blocked: problem ?? blocked,
  };
}

export interface GeneralValues {
  description?: string;
  include_in_id_token?: boolean;
  include_in_access_token?: boolean;
  default_client_assignment?: string;
  consent_text?: string;
  display_order?: string;
}

interface Patch {
  description?: string | null;
  consent_text?: string | null;
  include_in_id_token?: boolean;
  include_in_access_token?: boolean;
  default_client_assignment?: string | null;
  display_order?: number;
}

// The body of an amendment: an emptied text field clears the value, and a
// number is sent as one.
export function generalPatch(changes: GeneralValues): Patch {
  const body: Patch = {};
  const emptied = (text: string): string | null => (text.trim() === '' ? null : text);
  if (changes.description !== undefined) body.description = emptied(changes.description);
  if (changes.consent_text !== undefined) body.consent_text = emptied(changes.consent_text);
  if (changes.include_in_id_token !== undefined) {
    body.include_in_id_token = changes.include_in_id_token;
  }
  if (changes.include_in_access_token !== undefined) {
    body.include_in_access_token = changes.include_in_access_token;
  }
  if (changes.default_client_assignment !== undefined) {
    body.default_client_assignment =
      changes.default_client_assignment === 'none' ? null : changes.default_client_assignment;
  }
  if (changes.display_order !== undefined) body.display_order = Number(changes.display_order);
  return body;
}

export const scopeFailureFields: readonly string[] = [
  'name',
  'description',
  'include_in_id_token',
  'include_in_access_token',
  'default_client_assignment',
  'consent_text',
  'display_order',
];
