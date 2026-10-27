import { randomBytes } from 'node:crypto';

// Usernames the specs seed. The password policy refuses a password that
// contains the username, and a random one does so now and then.
const SEEDED_USERNAMES = [
  'ada',
  'tao',
  'grace',
  'bohr',
  'curie',
  'dirac',
  'volta',
  'tesla',
  'wiles',
] as const;

export function randomPassword(
  prefix = '',
  avoid: readonly string[] = SEEDED_USERNAMES,
  bytes = 18,
): string {
  for (;;) {
    const candidate = `${prefix}${randomBytes(bytes).toString('base64url')}`;
    const lower = candidate.toLowerCase();
    if (!avoid.some((name) => lower.includes(name.toLowerCase()))) return candidate;
  }
}
