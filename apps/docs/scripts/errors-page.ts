import { ERROR_DOCS, ERROR_GROUPS } from '@odudu/kernel/docs';
import type { ErrorCode } from '@odudu/kernel';
import {
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

function adminSection(): string {
  const rows = Object.entries(ADMIN_PROBLEM_TYPES)
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
    ]);
  return [
    '## OAuth and OpenID Connect errors',
    'The protocol endpoints answer with the `error` values RFC 6749, RFC 6750, RFC 7591, RFC 8707 ' +
      'and OpenID Connect Core define. At the authorization endpoint a refusal that can be reported ' +
      'to the client is a redirect carrying `error`; one that cannot is a page. The token endpoint ' +
      'answers a JSON body.',
    table(['Code', 'Answered by', 'Meaning'], rows),
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
