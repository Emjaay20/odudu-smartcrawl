import { describe, expect, it } from 'vitest';
import { assertLoopbackBase, planInit, type InitInput } from '#/cli/init-plan';

const base: InitInput = {
  interactive: false,
  publicBaseUrl: 'http://localhost:3000',
  stateDir: '/var/lib/odudu',
};

describe('planInit', () => {
  it.each([
    [{}, { hasSecretsFile: false, adminExists: false }, 'generate', 'create', 'generated'],
    [{}, { hasSecretsFile: true, adminExists: false }, 'reuse', 'create', 'generated'],
    [{ adminPassword: 'x' }, { hasSecretsFile: true, adminExists: true }, 'reuse', 'exists', 'env'],
    [
      { interactive: true },
      { hasSecretsFile: false, adminExists: false },
      'generate',
      'create',
      'prompt',
    ],
    [
      { interactive: true, adminPassword: 'x' },
      { hasSecretsFile: false, adminExists: false },
      'generate',
      'create',
      'env',
    ],
  ] as const)('plans %j with %j', (input, state, secrets, admin, passwordSource) => {
    expect(planInit({ ...base, ...input }, state)).toEqual({ secrets, admin, passwordSource });
  });
});

describe('assertLoopbackBase', () => {
  it.each(['http://localhost:3000', 'http://127.0.0.1:3210', 'http://[::1]:3000'])(
    'accepts %s',
    (url) => {
      expect(() => {
        assertLoopbackBase(url);
      }).not.toThrow();
    },
  );

  it('refuses a public host and says where to read about deploying', () => {
    expect(() => {
      assertLoopbackBase('https://id.example.com');
    }).toThrow(/ODUDU_PUBLIC_BASE_URL.*Deploying section/su);
  });

  it('refuses a value that is not a URL', () => {
    expect(() => {
      assertLoopbackBase('not a url');
    }).toThrow(/ODUDU_PUBLIC_BASE_URL/u);
  });
});
