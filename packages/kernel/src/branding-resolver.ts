import { type PageKind } from '#/page-kinds';
import {
  MAX_SIGN_IN_PATH_LENGTH,
  withBranding,
  type PageLocale,
  type ResolvedBranding,
} from '#/page';

// The longest OAuth client_id a page may name; longer is no client.
export const MAX_CLIENT_ID_LENGTH = 255;

export interface BrandingScope {
  tenantId: string;
  // The tenant's name as it appears in `/tenants/:tenant/…`, for the URLs of
  // its assets.
  tenantName: string;
  // The OAuth `client_id` the page is for, or null for the tenant alone.
  clientId: string | null;
}

// What a page needs from a resolved theme: the branding, and the hook that
// is told when one of its templates could not be filled, scoped to the
// theme version so the log hears of it once.
export interface PageBranding {
  branding: ResolvedBranding;
  templateFallback: (kind: PageKind, reason: string) => void;
}

// Injected where pages are served: the packages that render them cannot
// import each other or the theme package. A resolver answers null for a
// page with no theme and never rejects.
export type BrandingResolver = (scope: BrandingScope) => Promise<PageBranding | null>;

// Every page whose tenant is known takes its locale through here, so a route
// cannot render a themeable page without asking for its theme.
export async function brandLocale(
  locale: PageLocale,
  resolve: BrandingResolver | undefined,
  scope: BrandingScope | null,
): Promise<PageLocale> {
  if (resolve === undefined || scope === null) return locale;
  const found = await resolve(scope);
  return found === null ? locale : withBranding(locale, found.branding, found.templateFallback);
}

// The client an account page was reached for: the one its `return_to`
// authorize path names, and only when it is a registered client of this
// tenant. Anything else, a foreign or unknown id included, is no client, so
// the page cannot say whether a client exists.
export async function clientFromReturnTo(
  tenant: string,
  returnTo: string | null,
  isClientOfTenant: (clientId: string) => Promise<boolean>,
): Promise<string | null> {
  if (returnTo === null || returnTo.length > MAX_SIGN_IN_PATH_LENGTH) return null;
  const prefix = `/tenants/${encodeURIComponent(tenant)}/protocol/openid-connect/auth?`;
  if (!returnTo.startsWith(prefix)) return null;
  const named = new URLSearchParams(returnTo.slice(prefix.length)).getAll('client_id');
  const [id] = named;
  if (named.length !== 1 || id === undefined || id === '' || id.length > MAX_CLIENT_ID_LENGTH) {
    return null;
  }
  try {
    return (await isClientOfTenant(id)) ? id : null;
  } catch {
    return null;
  }
}
