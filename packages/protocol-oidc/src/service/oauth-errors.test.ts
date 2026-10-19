import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { type TokenErrorCode } from '#/service/errors';
import { OAUTH_ERROR_DOCS, type OAuthErrorCode } from '#/service/oauth-errors';

const SRC = path.resolve(import.meta.dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [full] : [];
  });
}

// Adding a code to TokenErrorCode without listing it here, or listing one it
// does not have, fails `pnpm typecheck`.
const TOKEN_CODES: Record<TokenErrorCode, true> = {
  invalid_client: true,
  invalid_grant: true,
  invalid_request: true,
  invalid_scope: true,
  invalid_target: true,
  unauthorized_client: true,
  unsupported_grant_type: true,
};

describe('the OAuth error codes', () => {
  it('lists every code the token endpoint can answer with, as a token error', () => {
    const documented = Object.entries(OAUTH_ERROR_DOCS)
      .filter(([, docs]) => docs.surfaces.includes('token'))
      .map(([code]) => code)
      .sort();
    expect(documented).toEqual(Object.keys(TOKEN_CODES).sort());
  });

  it('names only codes that the source still writes', () => {
    const text = sources(SRC)
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    const gone = (Object.keys(OAUTH_ERROR_DOCS) as OAuthErrorCode[]).filter(
      (code) => !text.includes(`'${code}'`),
    );
    expect(gone).toEqual([]);
  });

  it('gives each code the surfaces that answer with it and a one-paragraph meaning', () => {
    for (const [code, docs] of Object.entries(OAUTH_ERROR_DOCS)) {
      expect(docs.surfaces.length, code).toBeGreaterThan(0);
      expect(docs.summary, code).toMatch(/^\S.*\.$/u);
      expect(docs.summary, code).not.toContain('\n');
    }
  });
});
