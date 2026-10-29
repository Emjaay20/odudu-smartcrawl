import { tenants, type TenantScopedDatabase } from '@odudu/db';
import { type MailBranding } from '@odudu/kernel';
import { eq } from 'drizzle-orm';

export interface MailTenantScope {
  readonly tenantId: string;
  readonly tenantName: string;
}

// Injected where mail is queued, because the theme belongs to
// @odudu/domain-theme and this package does not depend on it. It reads
// through the transaction the mail is written in. Absent, mail is unthemed.
export type MailBrandingResolver = (
  tx: TenantScopedDatabase,
  scope: MailTenantScope,
) => Promise<MailBranding | null>;

export interface MailContext {
  readonly branding: MailBranding | null;
  readonly tenantDefaultLocale: string | null;
}

// A theme that cannot be had never stops the mail it would have dressed: the
// resolver is told to read in a savepoint, and what it still throws leaves
// the mail unthemed.
async function resolved(
  resolve: MailBrandingResolver,
  tx: TenantScopedDatabase,
  scope: MailTenantScope,
): Promise<MailBranding | null> {
  try {
    return await resolve(tx, scope);
  } catch {
    return null;
  }
}

export interface TenantMailContext extends MailContext {
  readonly displayName: string | null;
}

// The same read that also names the tenant, for a caller that shows a mail
// before it is sent: one theme read and one tenant statement, whatever the
// theme names.
export async function tenantMailContext(
  tx: TenantScopedDatabase,
  resolve: MailBrandingResolver | undefined,
  scope: MailTenantScope,
): Promise<TenantMailContext> {
  const branding = resolve === undefined ? null : await resolved(resolve, tx, scope);
  const [row] = await tx
    .select({ defaultLocale: tenants.defaultLocale, displayName: tenants.displayName })
    .from(tenants)
    .where(eq(tenants.id, scope.tenantId));
  return {
    branding,
    tenantDefaultLocale: row?.defaultLocale ?? null,
    displayName: row?.displayName ?? null,
  };
}

// What a mail needs from its tenant beyond the text, decided once when the
// mail is queued: the outbox row keeps the rendered result, so a theme
// published after this moment does not reach a mail already queued. Both
// reads are made whether or not the mail is then written, so a caller that
// must answer in the same time either way can make them before it decides.
export async function mailContext(
  tx: TenantScopedDatabase,
  resolve: MailBrandingResolver | undefined,
  scope: MailTenantScope,
): Promise<MailContext> {
  const { branding, tenantDefaultLocale } = await tenantMailContext(tx, resolve, scope);
  return { branding, tenantDefaultLocale };
}
