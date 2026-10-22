// What a mailed link may carry of the request being signed in to. The link
// sits in a mailbox, in a relay's logs and in a mail client's history, so it
// holds only what starts a sign-in again: the client, where the answer goes,
// the scope, and the PKCE challenge (a hash the protocol already sends in the
// open, which /authorize requires). `state` and `nonce` are the request's own
// per-flow binders, `claims` can hold requested values, and `prompt` and
// `max_age` only shape how the first attempt went: none of them is mailed.
const MAILED_PARAMETERS = [
  'response_type',
  'client_id',
  'redirect_uri',
  'scope',
  'code_challenge',
  'code_challenge_method',
  'ui_locales',
  'resource',
] as const;

// `path` has already been through signInPath, so it is this tenant's authorize
// path with a query.
export function mailedSignInPath(path: string | null | undefined): string | null {
  if (path === null || path === undefined) return null;
  const url = new URL(path, 'http://localhost');
  const kept = new URLSearchParams();
  for (const name of MAILED_PARAMETERS) {
    const value = url.searchParams.get(name);
    if (value !== null) kept.set(name, value);
  }
  return kept.size === 0 ? null : `${url.pathname}?${kept.toString()}`;
}

// The one place a mailed link to /login-actions/action-token is built, so the
// tenant is always one encoded path segment and the way back always the
// reduced one.
export function actionLink(
  issuerBase: string,
  tenantName: string,
  token: string,
  signInPath: string | null | undefined,
): string {
  const base = `${issuerBase}/tenants/${encodeURIComponent(tenantName)}/login-actions/action-token`;
  const back = mailedSignInPath(signInPath);
  const query = new URLSearchParams({ key: token });
  if (back !== null) query.set('return_to', back);
  return `${base}?${query.toString()}`;
}
