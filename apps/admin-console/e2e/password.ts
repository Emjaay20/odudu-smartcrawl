import { randomBytes } from 'node:crypto';

// Usernames the specs seed, of the lengths a random password can contain by
// chance: the password policy refuses one that contains the username.
// tests/e2e-trace/password.test.ts fails when global-setup.ts seeds one more.
export const SEEDED_USERNAMES = [
  'ada',
  'ampere',
  'baird',
  'bell',
  'bohm',
  'bob',
  'bohr',
  'born',
  'cantor',
  'church',
  'curie',
  'darwin',
  'diffie',
  'dirac',
  'edison',
  'euler',
  'first',
  'fermi',
  'gauss',
  'godel',
  'grace',
  'hertz',
  'hopper',
  'ines',
  'joule',
  'kelvin',
  'kepler',
  'knuth',
  'lamarr',
  'lise',
  'mendel',
  'morse',
  'ohm',
  'pauli',
  'planck',
  'rivest',
  'shamir',
  'tao',
  'tarski',
  'tesla',
  'turing',
  'volta',
  'wiles',
] as const;

const MAX_ATTEMPTS = 100;

export function randomPassword(
  prefix = '',
  avoid: readonly string[] = SEEDED_USERNAMES,
  bytes = 18,
): string {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const candidate = `${prefix}${randomBytes(bytes).toString('base64url')}`;
    const lower = candidate.toLowerCase();
    if (!avoid.some((name) => lower.includes(name.toLowerCase()))) return candidate;
  }
  throw new Error(
    `randomPassword: no password with prefix "${prefix}" avoided every name in ${String(MAX_ATTEMPTS)} draws; the prefix or the avoid list contains an avoided name`,
  );
}
