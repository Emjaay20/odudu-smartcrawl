import { ERROR_CODES } from '@odudu/kernel';
import { ADMIN_PROBLEM_TYPES, problemTypeUri } from '@odudu/protocol-admin/docs';
import { OAUTH_ERROR_DOCS, surfacesOf, type OAuthErrorCode } from '@odudu/protocol-oidc/docs';
import { describe, expect, it } from 'vitest';
import { renderErrorsPage } from './errors-page.ts';

const LABELS = {
  authorization: 'authorization endpoint',
  token: 'token endpoint',
  userinfo: 'UserInfo endpoint',
  registration: 'client registration',
} as const;

const text = renderErrorsPage();

function rows(): string[] {
  return text.split('\n').filter((line) => line.startsWith('| `'));
}

describe('the error code reference', () => {
  it('lists every admin problem type with its status and meaning', () => {
    for (const [name, entry] of Object.entries(ADMIN_PROBLEM_TYPES)) {
      const row = rows().find((line) => line.startsWith(`| \`${problemTypeUri(name)}\` |`));
      expect(row, name).toBeDefined();
      expect(row, name).toContain(`| ${String(entry.status)} |`);
    }
  });

  it('lists every OAuth and OpenID Connect error with where it is answered', () => {
    for (const code of Object.keys(OAUTH_ERROR_DOCS) as OAuthErrorCode[]) {
      const row = rows().find((line) => line.startsWith(`| \`${code}\` |`));
      expect(row, code).toBeDefined();
      for (const surface of surfacesOf(code))
        expect(row, `${code} ${surface}`).toContain(LABELS[surface]);
    }
  });

  it('lists every server and command error code once', () => {
    for (const code of ERROR_CODES) {
      expect(
        rows().filter((line) => line.startsWith(`| \`${code}\` |`)),
        code,
      ).toHaveLength(1);
    }
  });

  it('links its problem details explanation to a heading that exists', () => {
    expect(text).toContain('(./admin-api/index.md#problem-details)');
  });
});
