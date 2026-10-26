import { type TenantScopedDatabase } from '@odudu/db';
import { sql } from 'drizzle-orm';

// Taken before the check for an address and held until the transaction ends,
// so two creations for one address (any case) take turns and the one that
// comes second finds what the first committed. Self-registration, a
// registration link and the administrator door each take it before they look;
// the seed command, run by an operator, does not. The match is the ASCII
// lower-casing Postgres' lower() does under the C collation, as
// users.email_search is.
export async function lockEmailForCreation(
  tx: TenantScopedDatabase,
  tenantId: string,
  email: string,
): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${tenantId} || ':' || lower(${email}), 0))`,
  );
}
