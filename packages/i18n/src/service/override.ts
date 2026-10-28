import { IntlMessageFormat } from 'intl-messageformat';
import { type MessageValues } from '#/service/catalogue';

export const MAX_OVERRIDE_LENGTH = 2000;

// A tenant's text is untrusted: a `<` is a character to show, never a rich-text
// tag for the message syntax to strip or choke on.
function formatterFor(message: string, tag: string): IntlMessageFormat {
  return new IntlMessageFormat(message, tag, undefined, { ignoreTag: true });
}

// What is wrong with a message a tenant wants shown in place of a catalogue
// one, or null. Markup is not wrong: it is escaped where it is shown.
export function overrideProblem(message: string): string | null {
  if (message === '') return 'must not be empty';
  if (message.length > MAX_OVERRIDE_LENGTH) {
    return `must be at most ${String(MAX_OVERRIDE_LENGTH)} characters`;
  }
  // The two private-use characters translators.ts marks isolated slots with.
  if (/[\uE000\uE001]/u.test(message)) return 'contains a character reserved for the server';
  try {
    formatterFor(message, 'en');
  } catch {
    return 'is not a valid message: check its braces and plural arms';
  }
  return null;
}

// One parsed message per (map, key): the map is the cached per-tenant,
// per-locale one, so the parse is paid once while it lives.
const parsed = new WeakMap<object, Map<string, IntlMessageFormat | null>>();

// The override formatted, or null when it cannot be: a placeholder the page
// does not supply, or syntax a stored message should never have had.
export function formatOverride(
  overrides: Readonly<Record<string, string>>,
  tag: string,
  id: string,
  values: MessageValues | undefined,
): string | null {
  if (!Object.hasOwn(overrides, id)) return null;
  let byKey = parsed.get(overrides);
  if (byKey === undefined) {
    byKey = new Map();
    parsed.set(overrides, byKey);
  }
  let formatter = byKey.get(id);
  if (formatter === undefined) {
    try {
      formatter = formatterFor(overrides[id] ?? '', tag);
    } catch {
      formatter = null;
    }
    byKey.set(id, formatter);
  }
  if (formatter === null) return null;
  try {
    const out = formatter.format(values);
    return typeof out === 'string' ? out : [out].flat().join('');
  } catch {
    return null;
  }
}
