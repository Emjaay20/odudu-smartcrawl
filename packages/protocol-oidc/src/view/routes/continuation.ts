import { type PendingRequest } from '@odudu/authn-flows';
import { negotiateLocale, SHIPPED_LOCALES } from '@odudu/i18n';
import { withLocale, type RenderedPage } from '@odudu/kernel';
import { type FastifyReply } from 'fastify';

export interface ContinuationDeps {
  findTenant(name: string): Promise<{ id: string } | null>;
  loadPendingRequest(tenantId: string, authSessionId: string): Promise<PendingRequest | null>;
  // The parked request whatever the session's state: expired, consumed or
  // live. Not a liveness check, so never a reason to act on the session;
  // sendSignInExpired reads it only to rebuild a link to /authorize.
  recoverPendingRequest(tenantId: string, authSessionId: string): Promise<PendingRequest | null>;
  // Whether the client is still enabled and still registers this
  // redirect_uri. A parked redirect_uri was validated once; it is offered
  // back to the person only if it still is.
  redirectStillRegistered(
    tenantId: string,
    oauthClientId: string,
    redirectUri: string,
  ): Promise<boolean>;
  // The tags a page can be shown in; defaults to what the server ships.
  pageLocales?: readonly string[];
}

// A page whose form continues a parked authorization request can be answered
// with a 302 to that request's client, so it names the client's redirect_uri
// for `pageHeaders` to license (ADR 0018). The value is the one /authorize
// validated and parked, never anything the browser submitted. The same
// parked request carries `ui_locales`, so this is also where the page's
// language is negotiated, once per response (ADR 0043). The subject's own
// locale joins the order once a page after the first factor has text to
// translate; until then it would change nothing a person could see.
export async function continuing(
  deps: ContinuationDeps,
  tenantName: string,
  authSessionId: string,
  page: RenderedPage,
  reply: FastifyReply,
): Promise<RenderedPage> {
  const tenant = await deps.findTenant(tenantName);
  const pending = tenant === null ? null : await deps.loadPendingRequest(tenant.id, authSessionId);
  const locale = negotiateLocale({
    uiLocales: pending?.uiLocales ?? [],
    subjectLocale: null,
    authenticated: false,
    tenantDefault: null,
    acceptLanguage: reply.request.headers['accept-language'] ?? null,
    supported: deps.pageLocales ?? SHIPPED_LOCALES,
  });
  const localized = withLocale(page, locale);
  return pending === null ? localized : { ...localized, redirectsTo: pending.redirectUri };
}
