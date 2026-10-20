import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUDIT_REFUSAL_ROWS_PER_CLIENT } from '../../apps/server/src/app.js';
import { servingApp } from '../../apps/server/src/testing/served-routes.js';
import { PASSKEY } from '../../packages/authn-flows/src/service/authenticators/names.js';
import {
  generateRecoveryCodes,
  RECOVERY_CODE_COUNT,
  recoveryApplicable,
} from '../../packages/authn-flows/src/service/authenticators/recovery.js';
import { decideConsent } from '../../packages/protocol-oidc/src/service/consent.js';
import { REPO_ROOT } from './markdown.js';

const CONCEPTS = 'apps/docs/content/en/concepts';

const PAGES = [
  'tenants',
  'clients',
  'scopes',
  'roles-and-groups',
  'sessions',
  'tokens',
  'consent-and-audit',
] as const;

function body(page: string): string {
  return readFileSync(path.join(REPO_ROOT, CONCEPTS, `${page}.mdx`), 'utf8');
}

// The pages' structure, diagrams and schema facts are held by
// apps/docs/tests/concepts.test.ts. What needs the server's own code, its
// router, its consent decision and its recovery rules, is held here, where
// that code can be imported and typechecked.

// A method and path a concept page tells a reader to call, found by the shape
// `METHOD /path` in code font, compared with what the server routes.
const CALL = /`(GET|POST|PUT|PATCH|DELETE) (\/[^`\s]*)`/gu;

function shape(url: string): string {
  return url
    .replace(/\{[^}]+\}/gu, '*')
    .replace(/:[A-Za-z]+/gu, '*')
    .replace(/\/$/u, '');
}

describe('the concept pages name only routes the server has', () => {
  it('serves every method and path they call', async () => {
    const { endpoints } = await servingApp();
    const served = new Set(
      endpoints.map((endpoint) => `${endpoint.method} ${shape(endpoint.url)}`),
    );
    const named = PAGES.flatMap((page) =>
      [...body(page).matchAll(CALL)].map((match) => ({
        page,
        call: `${match[1] ?? ''} ${shape(match[2] ?? '')}`,
      })),
    );

    expect(named.length).toBeGreaterThan(0);
    expect(named.filter(({ call }) => !served.has(call))).toEqual([]);
  });
});

describe('the audit refusal budget the consent and audit page states', () => {
  it('is the one the server applies', () => {
    expect(AUDIT_REFUSAL_ROWS_PER_CLIENT).toBe(20);
    expect(body('consent-and-audit')).toContain('20 refusals');
  });
});

describe('the consent decisions the consent and audit page describes are the ones the server takes', () => {
  const base = {
    requestedScopes: ['openid', 'email'],
    defaultScopes: ['openid'],
    optionalScopes: ['email'],
    grantedScopes: [] as string[],
    prompt: new Set<'consent' | 'none'>(),
    consentRequired: false,
  };

  it('asks when the request says prompt=consent, whatever the client is set to', () => {
    expect(decideConsent({ ...base, prompt: new Set(['consent']) }).kind).toBe('ask');
    expect(body('consent-and-audit')).toContain('prompt=consent');
  });

  it('does not ask for a client that does not require it', () => {
    expect(decideConsent(base).kind).toBe('not_required');
  });

  it('asks once, and not again for what was granted', () => {
    const required = { ...base, consentRequired: true };
    expect(decideConsent(required).kind).toBe('ask');
    expect(decideConsent({ ...required, grantedScopes: ['openid', 'email'] }).kind).toBe(
      'not_required',
    );
  });

  it('asks again when the client wants more than was granted', () => {
    const required = { ...base, consentRequired: true, grantedScopes: ['openid'] };
    expect(decideConsent(required).kind).toBe('ask');
  });

  it('refuses with consent_required when the request forbids a screen', () => {
    const refused = decideConsent({ ...base, consentRequired: true, prompt: new Set(['none']) });
    expect(refused).toEqual({ kind: 'refuse', error: 'consent_required' });
    expect(body('consent-and-audit')).toContain('prompt=none');
  });
});

describe('the recovery code rules the sessions page states are the ones the sign-in applies', () => {
  it('a recovery code stands in for an authenticator code and never follows a passkey', () => {
    const held = { hasRecoveryCodes: true };

    expect(recoveryApplicable(held, true, true, new Set([PASSKEY]))).toBe(false);
    expect(recoveryApplicable(held, true, true, new Set())).toBe(true);
    expect(recoveryApplicable({ hasRecoveryCodes: false }, true, true, new Set())).toBe(false);
  });

  it('a set holds ten codes, each of them different', () => {
    expect(RECOVERY_CODE_COUNT).toBe(10);
    expect(new Set(generateRecoveryCodes(RECOVERY_CODE_COUNT)).size).toBe(RECOVERY_CODE_COUNT);
    expect(body('sessions')).toContain('ten recovery codes');
  });
});
