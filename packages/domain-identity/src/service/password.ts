import { hash, verify } from '@node-rs/argon2';

// @node-rs/argon2 declares Algorithm as an ambient const enum, which
// verbatimModuleSyntax forbids importing as a value — 2 is Argon2.Algorithm.Argon2id
// (see index.d.ts in the package).
const ARGON2ID = 2;

// OWASP Password Storage Cheat Sheet, Argon2id section: minimum recommended
// baseline is 19 MiB memory, 2 iterations, 1 degree of parallelism.
// https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
const OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  try {
    return await verify(stored, plain, OPTIONS);
  } catch {
    // A hash corrupted by a bad migration must fail the login, not the request.
    return false;
  }
}

export function normalisePassword(plain: string): string {
  return plain.normalize('NFC');
}

// NIST SP 800-63B-4 asks that a password be NFC-normalised before it is
// hashed. For client secrets and recovery codes use hashPassword: those are
// generated, not typed.
export async function hashUserPassword(plain: string): Promise<string> {
  return hashPassword(normalisePassword(plain));
}

export type PasswordMatch = 'normalised' | 'as-typed';

// Which form of what was typed a stored hash was made from, if either. The
// as-typed form is tried only when the caller says the hash may predate
// normalising (`tryAsTyped`) and the typed form is not already normalised, so
// a hash marked as normalised costs one verification whatever an attacker
// types. `verify` is a seam for counting them.
export async function matchUserPassword(
  stored: string,
  plain: string,
  tryAsTyped: boolean,
  verify: (stored: string, plain: string) => Promise<boolean> = verifyPassword,
): Promise<PasswordMatch | null> {
  const normalised = normalisePassword(plain);
  if (await verify(stored, normalised)) return 'normalised';
  if (tryAsTyped && normalised !== plain && (await verify(stored, plain))) return 'as-typed';
  return null;
}

// For a check by somebody already authenticated (a reuse check, a seed): a
// hash made before normalising was made from the bytes as typed, so both
// forms are tried. A login uses matchUserPassword with the row's marker.
export async function verifyUserPassword(stored: string, plain: string): Promise<boolean> {
  return (await matchUserPassword(stored, plain, true)) !== null;
}
