import { type TenantScopedDatabase } from '@odudu/db';
import { sql } from 'drizzle-orm';

// Everything that creates an account for an address takes this first, so two
// of them for one address (any case) take turns, and the one that comes second
// finds what the first committed. Held until the transaction ends, and shared
// by every creator: `composeUserSubject` takes it for administrators, the seed
// command and self-registration alike. The match is the ASCII lower-casing
// Postgres' lower() does under the C collation, as users.email_search is.
export async function lockEmailForCreation(
  tx: TenantScopedDatabase,
  tenantId: string,
  email: string,
): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${tenantId} || ':' || lower(${email}), 0))`,
  );
}
