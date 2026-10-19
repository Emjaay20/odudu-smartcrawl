import { type PendingRequest } from '@odudu/authn-flows';
import { negotiatePageLocale } from '@odudu/i18n';
import { type PageLocale, type RenderedPage } from '@odudu/kernel';
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
  // The `locale` attribute of a subject, read only for a page shown after
  // the first factor was verified (ADR 0043, step 2).
  subjectLocale?(tenantId: string, subjectId: string): Promise<string | null>;
  // Whom a finished authentication bound to this session, for pages shown
  // once it is finished.
  authenticatedSubject?(tenantId: string, authSessionId: string): Promise<string | null>;
}

// The language a page without a parked request is shown in: the browser's
// preference alone, since nothing else about the request is known.
export function requestLocale(
  reply: FastifyReply,
  deps: { pageLocales?: readonly string[] | undefined } = {},
): PageLocale {
  return negotiatePageLocale({
    acceptLanguage: reply.request.headers['accept-language'],
    ...(deps.pageLocales === undefined ? {} : { supported: deps.pageLocales }),
  });
}

// Who is asking for the page, as far as the language may use it. `subject`
// names a subject whose first factor is verified; `authenticated` asks the
// session which one a finished authentication bound.
export type PageSubject = { readonly subject: string } | 'authenticated';

export interface PageContinuation {
  // Negotiated before the renderer runs, so the text and the `lang` it is
  // sent under come from one value (ADR 0043).
  readonly locale: PageLocale;
  // A page whose form continues a parked authorization request can be
  // answered with a 302 to that request's client, so it names the client's
  // redirect_uri for `pageHeaders` to license (ADR 0018). The value is the
  // one /authorize validated and parked, never anything the browser posted.
  readonly continuing: (page: RenderedPage) => RenderedPage;
}

// Loads the parked request once and answers both questions that need it: the
// page's language (`ui_locales`, then the subject's own locale once they are
// known, then Accept-Language) and the redirect its form may follow.
export async function continuation(
  deps: ContinuationDeps,
  tenantName: string,
  authSessionId: string,
  reply: FastifyReply,
  who?: PageSubject,
): Promise<PageContinuation> {
  const tenant = await deps.findTenant(tenantName);
  const pending = tenant === null ? null : await deps.loadPendingRequest(tenant.id, authSessionId);
  let subjectId: string | null = null;
  if (tenant !== null && who !== undefined) {
    subjectId =
      who === 'authenticated'
        ? ((await deps.authenticatedSubject?.(tenant.id, authSessionId)) ?? null)
        : who.subject;
  }
  const subjectLocale =
    tenant !== null && subjectId !== null
      ? ((await deps.subjectLocale?.(tenant.id, subjectId)) ?? null)
      : null;
  const locale = negotiatePageLocale({
    uiLocales: pending?.uiLocales ?? [],
    subjectLocale,
    authenticated: subjectId !== null,
    acceptLanguage: reply.request.headers['accept-language'],
    ...(deps.pageLocales === undefined ? {} : { supported: deps.pageLocales }),
  });
  return {
    locale,
    continuing: (page) => (pending === null ? page : { ...page, redirectsTo: pending.redirectUri }),
  };
}
