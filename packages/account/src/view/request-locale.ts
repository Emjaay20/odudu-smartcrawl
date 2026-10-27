import { negotiatePageLocale } from '@odudu/i18n';
import {
  brandLocale,
  clientFromReturnTo,
  withPageTheme,
  type BrandingResolver,
  type PageLocale,
} from '@odudu/kernel';
import { type FastifyRequest } from 'fastify';

export interface BrandedLocaleDeps {
  pageLocales?: readonly string[] | undefined;
  // How a page asks for its tenant's or client's theme; none means the
  // default look.
  resolveBranding?: BrandingResolver | undefined;
  // Whether a client_id names a registered client of the tenant, asked only
  // for a `return_to` that names one.
  isClientOfTenant?: ((tenantId: string, clientId: string) => Promise<boolean>) | undefined;
}

// The language and theme an account page is shown in. Nothing is parked here
// and the person is not signed in, so the browser's preference alone chooses
// the language; the light or dark choice comes from the odudu-theme cookie.
// The tenant's theme applies when the tenant is known, and its client's when
// `return_to` names a registered client of that same tenant; any other
// value is no client, so a page cannot say whether a client exists. A page
// with no tenant (a refused link for an unknown tenant) passes null.
export async function brandedLocale(
  request: FastifyRequest,
  deps: BrandedLocaleDeps,
  tenant: { id: string; name: string } | null,
  returnTo: string | null = null,
): Promise<PageLocale> {
  const locale = withPageTheme(
    negotiatePageLocale({
      acceptLanguage: request.headers['accept-language'],
      ...(deps.pageLocales === undefined ? {} : { supported: deps.pageLocales }),
    }),
    request.headers.cookie,
  );
  if (tenant === null || deps.resolveBranding === undefined) return locale;
  const isClientOfTenant = deps.isClientOfTenant;
  const clientId = await clientFromReturnTo(tenant.name, returnTo, (id) =>
    isClientOfTenant === undefined ? Promise.resolve(false) : isClientOfTenant(tenant.id, id),
  );
  return brandLocale(locale, deps.resolveBranding, {
    tenantId: tenant.id,
    tenantName: tenant.name,
    clientId,
  });
}
