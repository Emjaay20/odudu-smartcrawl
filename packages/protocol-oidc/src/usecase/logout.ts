import { type PresentedSession } from '@odudu/authn-flows';
import { type SigningKeyRecord } from '@odudu/crypto';
import { type RequestContext } from '@odudu/domain-audit';
import { type FrontChannelTarget } from '#/repository/grants';
import { type TenantLookup } from '#/repository/tenant-lookup';
import { frontChannelLogoutUrl, MAX_FRONT_CHANNEL_FRAMES } from '#/service/frontchannel-logout';
import { mostRecentlyActive } from '#/service/session-selection';
import { subjectOfLogoutHint } from '#/usecase/authorization-request';

export interface LogoutSession {
  id: string;
  subjectId: string;
}

export interface LogoutInput {
  session: LogoutSession | null;
  requested: string | null;
  registered: readonly string[];
}

export type LogoutDecision =
  | { kind: 'confirm' }
  | { kind: 'end'; redirectTo: string | null }
  | { kind: 'render'; error: string };

export function decideRedirect(
  requested: string | null,
  registered: readonly string[],
): Exclude<LogoutDecision, { kind: 'confirm' }> {
  if (requested === null) return { kind: 'end', redirectTo: null };
  return registered.includes(requested)
    ? { kind: 'end', redirectTo: requested }
    : { kind: 'render', error: 'invalid_request' };
}

// §2: the OP SHOULD ask the End-User, so a session present is never ended on
// first contact, whatever hint came with it; a hint only identifies which
// session to ask about (docs/protocols/oidc-rpinitiated.md). With no session
// there is nothing to end, and a matched redirect is still honoured so an RP
// is not stranded after an idle-out. The redirect match is exact (§3).
export function decideLogout(
  input: LogoutInput,
): { kind: 'confirm' } | { kind: 'end'; redirectTo: string } {
  if (input.session !== null) return { kind: 'confirm' };
  if (input.requested !== null && input.registered.includes(input.requested)) {
    return { kind: 'end', redirectTo: input.requested };
  }
  return { kind: 'confirm' };
}

export interface LogoutRequestParams {
  idTokenHint: string | null;
  clientId: string | null;
  postLogoutRedirectUri: string | null;
  state: string | null;
}

export type LogoutOutcome =
  | { kind: 'not_found' }
  // The confirmation POST named no session the cookie resolves to, or
  // carried no token that session's entry proves. Distinct from `render`
  // below — nothing was ended, so the page must not say it was.
  | { kind: 'unauthenticated' }
  | {
      kind: 'confirm';
      sessionId: string | null;
      // The anti-forgery token the form carries beside `sessionId`, null
      // exactly when `sessionId` is (see LOGOUT_CONFIRMATION).
      csrf: string | null;
      clientId: string | null;
      postLogoutRedirectUri: string | null;
      // The same URI, only when it matches the client's registered list:
      // where the confirmation POST may redirect, and so what the page's
      // form-action has to license.
      registeredRedirect: string | null;
      state: string | null;
    }
  // The confirmation POST ended a session, or a first contact found none
  // to end and the registered redirect alone was honoured (see
  // decideLogout). `sessionEnded` tells the route whether there is a cookie
  // to clear. `frontChannelLogoutUrls` is empty when no session ended; with
  // a `redirectTo` it is the frames to show before the redirect
  // (Front-Channel Logout 1.0 §3).
  | {
      kind: 'end';
      redirectTo: string | null;
      state: string | null;
      sessionEnded: boolean;
      frontChannelLogoutUrls: readonly string[];
    }
  // Only the confirmation POST returns this: the redirect was refused, but
  // the session still ended and the page still renders — the same reason
  // `end`'s no-redirect branch frames its relying parties applies here too.
  | {
      kind: 'render';
      error: string;
      state: string | null;
      frontChannelLogoutUrls: readonly string[];
    };

export interface LogoutUsecaseDeps {
  findTenant(name: string): Promise<TenantLookup | null>;
  // Shared with /authorize's own hint validation — this tenant's own keys,
  // this tenant's issuer.
  listPublishableKeys(tenantId: string): Promise<SigningKeyRecord[]>;
  // Resolved from a client (the request's `client_id`, else its hint's one
  // audience) to that client's registered post_logout_redirect_uris; an
  // unknown or unspecified client yields an empty list, refusing any redirect
  // rather than resolving one with no client to trust it against (§3).
  postLogoutRedirectUris(tenantId: string, oauthClientId: string): Promise<readonly string[]>;
  // The browser's session cookies, resolved to their live rows exactly the
  // way /authorize resolves them — never trusted for anything but that
  // lookup.
  resolveSessions(
    tenant: {
      id: string;
      name: string;
      ssoSessionIdleSeconds: number;
      ssoSessionMaxSeconds: number;
      rememberMeIdleSeconds: number;
      rememberMeMaxSeconds: number;
    },
    header: string | undefined,
  ): Promise<PresentedSession[]>;
  // One transaction: ends the session row, revokes every grant whose
  // session_id is that session (Back-Channel Logout §2.7), and enqueues one
  // back-channel logout delivery per relying party that used the session
  // and registered a back-channel URI (§2.5). A failure anywhere — minting
  // or queuing a delivery included — rolls the whole transaction back, so a
  // session cannot end with a delivery lost: nothing would ever retry a row
  // that was never written. Access tokens are not touched: the RP-initiated
  // logout request path explains why not.
  endSession(
    tenantId: string,
    sessionId: string,
    subjectId: string,
    now: Date,
    issuer: string,
    request: RequestContext,
  ): Promise<void>;
  // Front-Channel Logout 1.0 §3's "set of logged-in RPs": the distinct
  // clients holding a grant issued under this session that registered a
  // front-channel logout URI, at most `limit` of them.
  frontChannelClientsForSession(
    tenantId: string,
    sessionId: string,
    limit: number,
  ): Promise<FrontChannelTarget[]>;
  now(): Date;
}

// Built for every branch that ends a session and renders a page, a
// redirecting one included: the frames load first and the page then sends
// the browser on (Front-Channel Logout 1.0 §3).
export async function frontChannelLogoutUrls(
  deps: Pick<LogoutUsecaseDeps, 'frontChannelClientsForSession'>,
  tenantId: string,
  issuer: string,
  sessionId: string,
): Promise<readonly string[]> {
  const targets = await deps.frontChannelClientsForSession(
    tenantId,
    sessionId,
    MAX_FRONT_CHANNEL_FRAMES,
  );
  const urls = targets.map((target) =>
    frontChannelLogoutUrl(
      target.frontchannelLogoutUri,
      issuer,
      sessionId,
      target.frontchannelLogoutSessionRequired,
    ),
  );
  return urls.filter((url): url is string => url !== null);
}

// §2 makes `client_id` optional. Without one, a hint that verified names the
// client it was issued to, but only when it names exactly one: a hint with
// several audiences says which of them is asking nowhere, so none is taken.
function clientOfRequest(
  clientId: string | null,
  hint: { audiences: readonly string[] } | null,
): string | null {
  if (clientId !== null) return clientId;
  const [only, ...rest] = hint?.audiences ?? [];
  return only !== undefined && rest.length === 0 ? only : null;
}

async function registeredUris(
  deps: LogoutUsecaseDeps,
  tenantId: string,
  clientId: string | null,
): Promise<readonly string[]> {
  if (clientId === null) return [];
  return deps.postLogoutRedirectUris(tenantId, clientId);
}

// The confirmation concerns one session, while a browser may hold several.
// A hint that names a `sid` identifies which one the End-User asked to end,
// so it is matched against the resolved set first; mostRecentlyActive
// (#/service/session-selection) is only the fallback for a hint that names
// nothing usable, the same stand-in the reuse decision at /authorize makes.
function selectLogoutSession(
  sessions: readonly PresentedSession[],
  hintSid: string | null,
): PresentedSession | null {
  const named = hintSid === null ? undefined : sessions.find((session) => session.id === hintSid);
  if (named !== undefined) return named;
  const recent = mostRecentlyActive(sessions);
  return sessions.find((session) => session.id === recent?.id) ?? null;
}

function toLogoutSession(session: PresentedSession | null): LogoutSession | null {
  return session === null ? null : { id: session.id, subjectId: session.subjectId };
}

// The purpose the confirmation form's token is bound to. The session id it
// sits beside is public — every token for the session carries it as `sid`
// — so the token is an HMAC keyed by the secret half of the cookie's entry,
// which a cross-site forger cannot read (SessionEntry.proof).
const LOGOUT_CONFIRMATION = 'logout-confirm';

// A `GET` (or unconfirmed `POST`) against the logout endpoint: the first
// contact. A session is never ended here; the page asks, and nothing ends
// until the confirmation form is posted back to handleLogoutConfirmation.
export async function handleLogoutRequest(
  deps: LogoutUsecaseDeps,
  tenantName: string,
  issuer: string,
  header: string | undefined,
  params: LogoutRequestParams,
): Promise<LogoutOutcome> {
  const tenant = await deps.findTenant(tenantName);
  if (!tenant?.enabled) return { kind: 'not_found' };

  const sessions = await deps.resolveSessions(
    {
      id: tenant.id,
      name: tenantName,
      ssoSessionIdleSeconds: tenant.ssoSessionIdleSeconds,
      ssoSessionMaxSeconds: tenant.ssoSessionMaxSeconds,
      rememberMeIdleSeconds: tenant.rememberMeIdleSeconds,
      rememberMeMaxSeconds: tenant.rememberMeMaxSeconds,
    },
    header,
  );
  // The hint is read with `aud` unchecked and `exp` unjudged. `aud` is
  // compared by `disagreeing`, below: §4 requires a disagreeing
  // `client_id`/hint pair told apart from no usable hint at all, and the
  // reader returns `null` for every failure alike. `exp` is left to the
  // question of whether it names the live session (§2; the reading note in
  // docs/protocols/oidc-rpinitiated.md).
  const hint =
    params.idTokenHint === null
      ? null
      : await subjectOfLogoutHint(deps, tenant.id, issuer, params.idTokenHint);
  const clientId = clientOfRequest(params.clientId, hint);
  const registered = await registeredUris(deps, tenant.id, clientId);

  // §2: "When both `client_id` and `id_token_hint` are present, the OP MUST
  // verify that the Client Identifier matches the one used when issuing the
  // ID Token." A pair that disagrees is an error detected in the request, so
  // §4 applies to it: neither half is used, and the redirect the hint would
  // otherwise have authorised is dropped with it.
  const disagreeing =
    params.clientId !== null && hint !== null && !hint.audiences.includes(params.clientId);
  const requested = disagreeing ? null : params.postLogoutRedirectUri;
  const hintSid = disagreeing ? null : (hint?.sid ?? null);
  const selected = selectLogoutSession(sessions, hintSid);
  const session = toLogoutSession(selected);

  const decision = decideLogout({ session, requested, registered });

  if (decision.kind === 'confirm') {
    return {
      kind: 'confirm',
      sessionId: session?.id ?? null,
      csrf:
        selected?.entry.proof(LOGOUT_CONFIRMATION, [
          clientId ?? '',
          requested ?? '',
          params.state ?? '',
        ]) ?? null,
      clientId,
      postLogoutRedirectUri: requested,
      registeredRedirect: requested !== null && registered.includes(requested) ? requested : null,
      state: params.state,
    };
  }

  // Reached only with no session: a matched redirect with nothing to end.
  return {
    kind: 'end',
    redirectTo: decision.redirectTo,
    state: params.state,
    sessionEnded: false,
    frontChannelLogoutUrls: [],
  };
}

export interface LogoutConfirmationParams {
  // The session the form names, which must be one the cookie itself still
  // resolves to. It is public, so on its own it proves nothing.
  confirmedSessionId: string;
  // The form's anti-forgery token, which must be the one that session's
  // own presented entry proves (LOGOUT_CONFIRMATION) over the form's
  // client_id, post_logout_redirect_uri and state; empty when absent.
  csrf: string;
  clientId: string | null;
  postLogoutRedirectUri: string | null;
  state: string | null;
}

// The confirmation form's POST: the End-User has already said yes, so only
// the redirect rule (§3) is still live.
export async function handleLogoutConfirmation(
  deps: LogoutUsecaseDeps,
  tenantName: string,
  issuer: string,
  header: string | undefined,
  params: LogoutConfirmationParams,
  request: RequestContext,
): Promise<LogoutOutcome> {
  const tenant = await deps.findTenant(tenantName);
  if (!tenant?.enabled) return { kind: 'not_found' };

  const sessions = await deps.resolveSessions(
    {
      id: tenant.id,
      name: tenantName,
      ssoSessionIdleSeconds: tenant.ssoSessionIdleSeconds,
      ssoSessionMaxSeconds: tenant.ssoSessionMaxSeconds,
      rememberMeIdleSeconds: tenant.rememberMeIdleSeconds,
      rememberMeMaxSeconds: tenant.rememberMeMaxSeconds,
    },
    header,
  );
  const confirmed = sessions.find(
    (candidate) =>
      candidate.id === params.confirmedSessionId &&
      candidate.entry.proves(LOGOUT_CONFIRMATION, params.csrf, [
        params.clientId ?? '',
        params.postLogoutRedirectUri ?? '',
        params.state ?? '',
      ]),
  );
  if (confirmed === undefined) {
    return { kind: 'unauthenticated' };
  }
  const session: LogoutSession = { id: confirmed.id, subjectId: confirmed.subjectId };

  const registered = await registeredUris(deps, tenant.id, params.clientId);
  // Consent was given by posting this form, so only the redirect rule is
  // still live.
  const decision = decideRedirect(params.postLogoutRedirectUri, registered);

  await deps.endSession(tenant.id, session.id, session.subjectId, deps.now(), issuer, request);

  if (decision.kind === 'end') {
    const frontChannel = await frontChannelLogoutUrls(deps, tenant.id, issuer, session.id);
    return {
      kind: 'end',
      redirectTo: decision.redirectTo,
      state: params.state,
      sessionEnded: true,
      frontChannelLogoutUrls: frontChannel,
    };
  }
  const refusedFrontChannel = await frontChannelLogoutUrls(deps, tenant.id, issuer, session.id);
  return {
    kind: 'render',
    error: decision.error,
    state: params.state,
    frontChannelLogoutUrls: refusedFrontChannel,
  };
}
