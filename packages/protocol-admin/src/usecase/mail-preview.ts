import { type PreviewMailQuery } from '@odudu/contracts/admin';
import { tenants, type TenantScopedDatabase } from '@odudu/db';
import {
  brandingInScheme,
  inlineMark,
  mailContext,
  renderVerifyEmail,
  type MailBrandingResolver,
} from '@odudu/email';
import { type MailBranding } from '@odudu/kernel';
import { eq } from 'drizzle-orm';

export interface MailPreviewDeps {
  readonly resolveMailBranding: MailBrandingResolver;
}

export interface TenantMail {
  readonly branding: MailBranding | null;
  readonly tenantDefaultLocale: string | null;
  readonly displayName: string;
}

// What the tenant's mail is dressed in as of its published theme: the read a
// queued mail makes, so the preview and the mail cannot disagree. Two
// statements, the theme's and the tenant's, whatever the theme names.
export async function tenantMail(
  tx: TenantScopedDatabase,
  deps: MailPreviewDeps,
  tenant: { tenantId: string; tenantName: string },
): Promise<TenantMail> {
  const context = await mailContext(tx, deps.resolveMailBranding, tenant);
  const [row] = await tx
    .select({ displayName: tenants.displayName })
    .from(tenants)
    .where(eq(tenants.id, tenant.tenantId));
  return { ...context, displayName: row?.displayName ?? tenant.tenantName };
}

export interface MailPreviewInput {
  readonly query: PreviewMailQuery;
  readonly issuerBase: string;
  readonly now: Date;
}

// The verification mail with a sample address and link, drawn in one scheme.
// Nothing is queued and nothing is written.
export function previewMail(
  mail: TenantMail,
  input: MailPreviewInput,
): { html: string; branding: MailBranding } {
  const branding = brandingInScheme(mail.branding, input.query.scheme ?? 'light');
  const message = renderVerifyEmail({
    to: 'ada@example.test',
    link: `${input.issuerBase}/verify-email?sample=1`,
    tenantDisplayName: mail.displayName,
    now: input.now,
    locale: input.query.locale ?? null,
    tenantDefaultLocale: mail.tenantDefaultLocale,
    branding,
  });
  return { html: inlineMark(message.html), branding };
}
