import { ERROR_CODES } from '@odudu/kernel';
import { ADMIN_PROBLEM_TYPES, problemTypeUri } from '@odudu/protocol-admin';
import { OAUTH_ERROR_DOCS } from '@odudu/protocol-oidc';
import { describe, expect, it } from 'vitest';
import { renderErrorsPage } from '#docs/scripts/errors-page.ts';

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
    for (const [code, docs] of Object.entries(OAUTH_ERROR_DOCS)) {
      const row = rows().find((line) => line.startsWith(`| \`${code}\` |`));
      expect(row, code).toBeDefined();
      if (docs.surfaces.includes('token')) expect(row, code).toContain('token endpoint');
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
