import { ERROR_DOCS, ERROR_GROUPS } from '@odudu/kernel/docs';
import type { ErrorCode } from '@odudu/kernel';
import {
  AUTHORIZE_REQUEST_DESCRIPTIONS,
  OAUTH_ERROR_DESCRIPTIONS,
  OAUTH_ERROR_DOCS,
  surfacesOf,
  type OAuthErrorCode,
  type OAuthSurface,
} from '@odudu/protocol-oidc/docs';
import {
  ADMIN_PROBLEM_TYPES,
  GENERIC_PROBLEM_SUMMARY,
  problemTypeUri,
} from '@odudu/protocol-admin/docs';
import { cell, codeCell, escapeProse, page, table } from './markdown.ts';

const SURFACE_LABELS: Record<OAuthSurface, string> = {
  authorization: 'authorization endpoint',
  token: 'token endpoint',
  userinfo: 'UserInfo endpoint',
  registration: 'client registration',
};

// Answered by the server's root for any address nothing serves, the admin API's
// among them, so it is listed here with the admin types a client switches on.
const UNROUTED_PROBLEM_TYPES = {
  'not-found': {
    status: 404,
    summary:
      'Nothing is served at the path, whichever API or tenant it names. `detail` is "No resource at this ' +
      'path"; it named the path and the route before. A browser that asks for a page is shown one instead.',
  },
};

function adminSection(): string {
  const rows = Object.entries({ ...ADMIN_PROBLEM_TYPES, ...UNROUTED_PROBLEM_TYPES })
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([name, entry]) => [
      codeCell(problemTypeUri(name)),
      String(entry.status),
      cell(entry.summary),
    ]);
  return [
    '## Admin API problems',
    escapeProse(GENERIC_PROBLEM_SUMMARY),
    'These refusals have a type of their own, which a client can switch on:',
    table(['Type', 'Status', 'Meaning'], rows),
    'A `400` that names fields carries an `errors` list; an entry has a `code` when the refusal has ' +
      'one, such as `bidi_control_refused` for a bidirectional control character in a typed field. ' +
      'The shape of the problem document is under [problem details](./admin-api/index.md#problem-details).',
    'An address nothing serves answers `404` with the type `about:blank#not-found`, and an unhandled ' +
      'failure `500` (every failure of status 500 or above answers 500). Both are problem documents ' +
      'whose `instance` is the request id. A browser that asks for a page, outside the admin, ' +
      'console API, health and protocol paths, is shown a branded page instead: the same page for ' +
      'every unknown address, with the request id on the failure page and nothing the request or ' +
      'the failure carried.',
  ].join('\n\n');
}

function oauthSection(): string {
  const rows = Object.entries(OAUTH_ERROR_DOCS)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([code, docs]) => [
      codeCell(code),
      cell(
        surfacesOf(code as OAuthErrorCode)
          .map((surface) => SURFACE_LABELS[surface])
          .join(', '),
      ),
      cell(docs.summary),
      code in OAUTH_ERROR_DESCRIPTIONS
        ? codeCell(OAUTH_ERROR_DESCRIPTIONS[code as keyof typeof OAUTH_ERROR_DESCRIPTIONS])
        : '',
    ]);
  return [
    '## OAuth and OpenID Connect errors',
    'The protocol endpoints answer with the `error` values RFC 6749, RFC 6750, RFC 7591, RFC 8707 ' +
      'and OpenID Connect Core define. At the authorization endpoint a refusal that can be reported ' +
      'to the client is a redirect carrying `error`; one that cannot is a page. The token endpoint ' +
      'answers a JSON body. The authorization and token endpoints add an `error_description`, one ' +
      'plain sentence that is never built from the request. Each code has one fixed sentence, ' +
      'and `invalid_grant` names no cause. The authorization endpoint adds a few that name the ' +
      'parameter at fault, listed after the table.',
    table(['Code', 'Answered by', 'Meaning', '`error_description`'], rows),
    'At the authorization endpoint, an `invalid_request` can say which parameter was wrong:',
    Object.values(AUTHORIZE_REQUEST_DESCRIPTIONS)
      .map((sentence) => `- ${codeCell(sentence)}`)
      .join('\n'),
  ].join('\n\n');
}

function commandSection(): string {
  const groups = ERROR_GROUPS.flatMap((group) => {
    const rows = (Object.entries(ERROR_DOCS) as [ErrorCode, (typeof ERROR_DOCS)[ErrorCode]][])
      .filter(([, docs]) => docs.group === group)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([code, docs]) => [codeCell(code), cell(docs.summary)]);
    return [`### ${group}`, table(['Code', 'Meaning'], rows)];
  });
  return [
    '## Server and command errors',
    'A command or the server that stops with an error prints its `code` and a message. A command ' +
      'that stops this way exits with a non-zero status.',
    ...groups,
  ].join('\n\n');
}

export function renderErrorsPage(): string {
  return page(
    'Error codes',
    'Every error code Odudu returns or prints: admin API problem types, OAuth and OpenID Connect errors, and server and command errors.',
    [
      'Odudu reports errors in three places: the admin API, the protocol endpoints and the ' +
        'server or command that fails to start. Each has its own vocabulary, listed below.',
      adminSection(),
      oauthSection(),
      commandSection(),
    ].join('\n\n'),
  );
}
