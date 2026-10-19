export type OAuthSurface = 'authorization' | 'token' | 'userinfo' | 'registration';

export interface OAuthErrorDoc {
  readonly surfaces: readonly OAuthSurface[];
  readonly summary: string;
}

// The `error` values this server answers with, from RFC 6749, RFC 6750,
// RFC 7591, RFC 8707 and OpenID Connect Core, and where each is answered.
const DOCS = {
  access_denied: {
    surfaces: ['authorization'],
    summary:
      'The user refused consent, or the sign-in the request was waiting on expired, so the ' +
      'client is sent back without a code.',
  },
  account_selection_required: {
    surfaces: ['authorization'],
    summary:
      'The request asked for no interaction (`prompt=none`) but the user must choose between ' +
      'accounts.',
  },
  consent_required: {
    surfaces: ['authorization'],
    summary:
      'The request asked for no interaction (`prompt=none`) but the user has not consented to ' +
      'what the client asks for.',
  },
  insufficient_scope: {
    surfaces: ['userinfo'],
    summary: 'The access token does not carry the `openid` scope the UserInfo endpoint requires.',
  },
  invalid_client: {
    surfaces: ['token'],
    summary: 'Client authentication failed: the client is unknown or its credential is wrong.',
  },
  invalid_client_metadata: {
    surfaces: ['registration'],
    summary:
      'A value in the registration request is not acceptable client metadata. `error_description` ' +
      'names the field.',
  },
  invalid_grant: {
    surfaces: ['token'],
    summary:
      'The authorization code or refresh token is unknown, expired, already used, issued to ' +
      'another client, or does not match the redirect URI or the PKCE verifier. The response ' +
      'never says which, by design.',
  },
  invalid_redirect_uri: {
    surfaces: ['registration'],
    summary: 'A redirect URI in the registration request is not one the server accepts.',
  },
  invalid_request: {
    surfaces: ['authorization', 'token', 'userinfo'],
    summary:
      'The request is malformed: a required parameter is missing, repeated or has an ' +
      'unacceptable value.',
  },
  invalid_scope: {
    surfaces: ['authorization', 'token'],
    summary: 'A requested scope is unknown, not assigned to the client, or malformed.',
  },
  invalid_target: {
    surfaces: ['authorization', 'token'],
    summary:
      'A `resource` indicator (RFC 8707) is malformed or names an audience the client may not ' +
      'request.',
  },
  invalid_token: {
    surfaces: ['userinfo', 'registration'],
    summary:
      'The access token, or the initial access token of a dynamic registration, is missing, ' +
      'expired, revoked, spent or otherwise not valid for this endpoint. UserInfo answers ' +
      'with `401` and a `WWW-Authenticate` challenge.',
  },
  login_required: {
    surfaces: ['authorization'],
    summary: 'The request asked for no interaction (`prompt=none`) but the user is not signed in.',
  },
  request_not_supported: {
    surfaces: ['authorization'],
    summary: 'The request carried a `request` object, which this server does not support.',
  },
  request_uri_not_supported: {
    surfaces: ['authorization'],
    summary: 'The request carried a `request_uri`, which this server does not support.',
  },
  unauthorized_client: {
    surfaces: ['token'],
    summary: 'The client is not allowed to use the grant type it asked for.',
  },
  unsupported_grant_type: {
    surfaces: ['token'],
    summary: 'The `grant_type` is not one this server supports.',
  },
  unsupported_response_type: {
    surfaces: ['authorization'],
    summary: 'The `response_type` is not one this server supports.',
  },
} as const satisfies Readonly<Record<string, OAuthErrorDoc>>;

export type OAuthErrorCode = keyof typeof DOCS;

export const OAUTH_ERROR_DOCS: Readonly<Record<OAuthErrorCode, OAuthErrorDoc>> = DOCS;
