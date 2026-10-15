const MAX_USERNAME_LENGTH = 128;
const MAX_TENANT_LENGTH = 64;

/**
 * The key of the per-address-and-username sign-in budget, read from the
 * submitted form and nothing else — never from a lookup, so a refusal
 * cannot answer differently for an account that exists. The username is
 * folded the way an attacker would vary it to dodge a literal match
 * (case, padding, compatibility forms) and cut to a fixed length so the
 * map's keys stay bounded. A submission that names none (the second-factor
 * and passkey steps carry the authentication session instead) has no key.
 */
export function loginBudgetKey(origin: string, tenant: string, body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const submitted: unknown = (body as Record<string, unknown>).username;
  const username = Array.isArray(submitted) ? (submitted as unknown[])[0] : submitted;
  if (typeof username !== 'string') return undefined;
  const folded = username.normalize('NFKC').trim().toLowerCase().slice(0, MAX_USERNAME_LENGTH);
  if (folded === '') return undefined;
  return `${origin}|${tenant.slice(0, MAX_TENANT_LENGTH)}|${folded}`;
}
