const MAX_USERNAME_LENGTH = 128;
const MAX_TENANT_LENGTH = 64;

/**
 * The key of the per-address-and-username sign-in budget, read from the
 * submitted form and nothing else — never from a lookup, so a refusal
 * cannot answer differently for an account that exists. The username is
 * folded the way an attacker would vary it (case, padding, compatibility
 * forms) and cut to a fixed length; a submission naming none the route
 * would read has no key. A JSON array keeps two triples from sharing one.
 */
export function loginBudgetKey(origin: string, tenant: string, body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const username: unknown = (body as Record<string, unknown>).username;
  if (typeof username !== 'string') return undefined;
  const folded = username
    .slice(0, MAX_USERNAME_LENGTH)
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .slice(0, MAX_USERNAME_LENGTH);
  if (folded === '') return undefined;
  return JSON.stringify([origin, tenant.slice(0, MAX_TENANT_LENGTH), folded]);
}
