export type OAuthSurface = 'authorization' | 'token' | 'userinfo' | 'registration';

// The `error` values each surface of the server answers with, from RFC 6749,
// RFC 6750, RFC 7591, RFC 8707 and OpenID Connect Core. The code types its
// error parameters with these, so a value outside its list does not compile.
export const AUTHORIZATION_ERRORS = [
  'access_denied',
  'account_selection_required',
  'consent_required',
  'invalid_client',
  'invalid_request',
  'invalid_scope',
  'invalid_target',
  'login_required',
  'request_not_supported',
  'request_uri_not_supported',
  'unsupported_response_type',
] as const;
export type AuthorizationErrorCode = (typeof AUTHORIZATION_ERRORS)[number];

export const TOKEN_ERRORS = [
  'invalid_client',
  'invalid_grant',
  'invalid_request',
  'invalid_scope',
  'invalid_target',
  'unauthorized_client',
  'unsupported_grant_type',
] as const;
export type TokenErrorCode = (typeof TOKEN_ERRORS)[number];

export const USERINFO_ERRORS = ['insufficient_scope', 'invalid_request', 'invalid_token'] as const;
export type UserinfoErrorCode = (typeof USERINFO_ERRORS)[number];

export const REGISTRATION_ERRORS = [
  'invalid_client_metadata',
  'invalid_redirect_uri',
  'invalid_token',
] as const;
export type RegistrationErrorCode = (typeof REGISTRATION_ERRORS)[number];

export type OAuthErrorCode =
  AuthorizationErrorCode | TokenErrorCode | UserinfoErrorCode | RegistrationErrorCode;

const SURFACE_CODES: Readonly<Record<OAuthSurface, readonly string[]>> = {
  authorization: AUTHORIZATION_ERRORS,
  token: TOKEN_ERRORS,
  userinfo: USERINFO_ERRORS,
  registration: REGISTRATION_ERRORS,
};

// Where a code is answered, read from the lists above and never written by hand.
export function surfacesOf(code: OAuthErrorCode): readonly OAuthSurface[] {
  return (Object.keys(SURFACE_CODES) as OAuthSurface[]).filter((surface) =>
    SURFACE_CODES[surface].includes(code),
  );
}

// The `error` values this server answers with, from RFC 6749, RFC 6750,
// RFC 7591, RFC 8707 and OpenID Connect Core, and where each is answered.
export const OAUTH_ERROR_DOCS: Readonly<Record<OAuthErrorCode, { readonly summary: string }>> = {
  access_denied: {
    summary:
      'The user refused consent, or the sign-in the request was waiting on expired, so the ' +
      'client is sent back without a code.',
  },
  account_selection_required: {
    summary:
      'The request asked for no interaction (`prompt=none`) but the user must choose between ' +
      'accounts.',
  },
  consent_required: {
    summary:
      'The request asked for no interaction (`prompt=none`) but the user has not consented to ' +
      'what the client asks for.',
  },
  insufficient_scope: {
    summary: 'The access token does not carry the `openid` scope the UserInfo endpoint requires.',
  },
  invalid_client: {
    summary: 'Client authentication failed: the client is unknown or its credential is wrong.',
  },
  invalid_client_metadata: {
    summary:
      'A value in the registration request is not acceptable client metadata. `error_description` ' +
      'names the field.',
  },
  invalid_grant: {
    summary:
      'The authorization code or refresh token is unknown, expired, already used, issued to ' +
      'another client, or does not match the redirect URI or the PKCE verifier. The response ' +
      'never says which, by design.',
  },
  invalid_redirect_uri: {
    summary: 'A redirect URI in the registration request is not one the server accepts.',
  },
  invalid_request: {
    summary:
      'The request is malformed: a required parameter is missing, repeated or has an ' +
      'unacceptable value.',
  },
  invalid_scope: {
    summary: 'A requested scope is unknown, not assigned to the client, or malformed.',
  },
  invalid_target: {
    summary:
      'A `resource` indicator (RFC 8707) is malformed or names an audience the client may not ' +
      'request.',
  },
  invalid_token: {
    summary:
      'The access token, or the initial access token of a dynamic registration, is missing, ' +
      'expired, revoked, spent or otherwise not valid for this endpoint. UserInfo answers ' +
      'with `401` and a `WWW-Authenticate` challenge.',
  },
  login_required: {
    summary: 'The request asked for no interaction (`prompt=none`) but the user is not signed in.',
  },
  request_not_supported: {
    summary: 'The request carried a `request` object, which this server does not support.',
  },
  request_uri_not_supported: {
    summary: 'The request carried a `request_uri`, which this server does not support.',
  },
  unauthorized_client: {
    summary: 'The client is not allowed to use the grant type it asked for.',
  },
  unsupported_grant_type: {
    summary: 'The `grant_type` is not one this server supports.',
  },
  unsupported_response_type: {
    summary: 'The `response_type` is not one this server supports.',
  },
};
