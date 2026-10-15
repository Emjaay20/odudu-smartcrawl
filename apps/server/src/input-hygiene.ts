const REPLACEMENT = '�';
const NUL = /\u0000/gu;
const CONTROLS = /[\u0000-\u001f\u007f-\u009f]/gu;
const LONE_SURROGATE = /[\uD800-\uDFFF]/gu;

// Typed identity: a control character in any of these is never part of a
// real value, and a NUL cannot be stored by the database at all.
const IDENTITY_FIELDS: ReadonlySet<string> = new Set([
  'username',
  'email',
  'code',
  'recovery_code',
]);

// Hashed and never queried, and a password may legitimately hold a tab, so
// only a lone surrogate (which would not survive being encoded) is repaired.
const SECRET_FIELDS: ReadonlySet<string> = new Set(['password']);

// With the u flag a surrogate pair is one code point, so only a lone one matches.
function wellFormed(value: string): string {
  return value.replace(LONE_SURROGATE, REPLACEMENT);
}

/**
 * What the database cannot hold as text — NUL and a lone surrogate — becomes
 * U+FFFD, so the value is simply one no account answers to rather than a
 * server error. `identity` widens that to every control character.
 */
export function neutralise(value: string, identity = false): string {
  return wellFormed(value).replace(identity ? CONTROLS : NUL, REPLACEMENT);
}

function clean(record: unknown, byName: boolean): void {
  if (typeof record !== 'object' || record === null) return;
  const fields = record as Record<string, unknown>;
  for (const [name, value] of Object.entries(fields)) {
    const secret = byName && SECRET_FIELDS.has(name);
    const identity = byName && IDENTITY_FIELDS.has(name);
    if (typeof value === 'string') {
      fields[name] = secret ? wellFormed(value) : neutralise(value, identity);
    } else if (Array.isArray(value)) {
      fields[name] = value.map((item: unknown) =>
        typeof item === 'string' ? neutralise(item, identity) : item,
      );
    }
  }
}

/** The parts of a request a person's typing or a link reaches the server through. */
export function neutraliseRequestInput(request: {
  params: unknown;
  query: unknown;
  body: unknown;
}): void {
  clean(request.params, false);
  clean(request.query, false);
  clean(request.body, true);
}
