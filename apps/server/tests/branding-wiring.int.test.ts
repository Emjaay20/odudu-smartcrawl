import {
  createDatabase,
  MIGRATIONS_DIR,
  runMigrations,
  tenants,
  type DatabaseHandle,
} from '@odudu/db';
import { MAX_PASSWORD_LENGTH, newId, type BrandingScope } from '@odudu/kernel';
import { createAppRole, startTestDatabase, type TestDatabase } from '@odudu/testkit';
import { eq } from 'drizzle-orm';
import { type FastifyInstance } from 'fastify';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '#/app';
import { seed } from '#/cli/seed';

// Every route that renders a themeable page is handed the resolver by the
// composition root. Each is driven here with a resolver that records who
// asked, so a registration that forgets to pass it fails by name.

let container: TestDatabase;
let owner: DatabaseHandle;
let appDb: DatabaseHandle;
let app: FastifyInstance;
const asked: BrandingScope[] = [];

const KEK = Buffer.alloc(32, 7);
const REDIRECT_URI = 'https://app.example/callback';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
let name = '';

beforeAll(async () => {
  container = await startTestDatabase();
  owner = createDatabase(container.adminUrl);
  await runMigrations(owner.db, MIGRATIONS_DIR);
  const appUrl = await createAppRole(container.adminUrl);
  appDb = createDatabase(appUrl, { max: 5 });
  process.env.ODUDU_DATABASE_URL = container.adminUrl;
  process.env.ODUDU_APP_DATABASE_URL = appUrl;
  process.env.ODUDU_KEK = KEK.toString('base64');
  name = `wiring-${newId()}`;
  const seeded = await seed({
    tenant: name,
    clientId: 'portal',
    redirectUris: [REDIRECT_URI],
    username: 'user',
    password: 'correct horse battery staple',
  });
  await owner.db
    .update(tenants)
    .set({ registrationAllowed: true, resetPasswordAllowed: true })
    .where(eq(tenants.id, seeded.tenantId));
  app = buildApp({
    database: appDb,
    ownerDatabase: owner,
    kek: KEK,
    logger: pino({ level: 'silent' }),
    tls: false,
    publicBaseUrl: 'https://id.example.test',
    throttle: { limit: 100_000, windowSeconds: 60 },
    branding: {
      resolveBranding: (scope) => {
        asked.push(scope);
        return Promise.resolve(null);
      },
      isClientOfTenant: () => Promise.resolve(false),
      invalidateTenant: () => undefined,
    },
  });
  await app.ready();
}, 120_000);

afterAll(async () => {
  await app.close();
  delete process.env.ODUDU_DATABASE_URL;
  delete process.env.ODUDU_APP_DATABASE_URL;
  delete process.env.ODUDU_KEK;
  await appDb.close();
  await owner.close();
  await container.stop();
});

const FORM = { 'content-type': 'application/x-www-form-urlencoded' };

async function asks(run: () => Promise<unknown>): Promise<BrandingScope[]> {
  asked.length = 0;
  await run();
  return [...asked];
}

describe('every route that renders a themeable page asks for its theme', () => {
  const cases: [string, () => Promise<unknown>][] = [
    [
      'authorize',
      () =>
        app.inject({
          url:
            `/tenants/${name}/protocol/openid-connect/auth?` +
            new URLSearchParams({
              response_type: 'code',
              client_id: 'portal',
              redirect_uri: REDIRECT_URI,
              scope: 'openid',
              code_challenge: CHALLENGE,
              code_challenge_method: 'S256',
            }).toString(),
        }),
    ],
    [
      'login',
      () =>
        app.inject({
          method: 'POST',
          url: `/tenants/${name}/login-actions/authenticate`,
          payload: new URLSearchParams({
            auth_session_id: newId(),
            username: 'user',
            password: 'a'.repeat(MAX_PASSWORD_LENGTH + 1),
          }).toString(),
          headers: FORM,
        }),
    ],
    ['logout', () => app.inject({ url: `/tenants/${name}/protocol/openid-connect/logout` })],
    ['registration', () => app.inject({ url: `/tenants/${name}/login-actions/registration` })],
    ['reset password', () => app.inject({ url: `/tenants/${name}/login-actions/reset-password` })],
    [
      'action token',
      () => app.inject({ url: `/tenants/${name}/login-actions/action-token?key=nothing` }),
    ],
  ];

  it.each(cases)('%s', async (_route, run) => {
    const scopes = await asks(run);
    expect(scopes.length).toBeGreaterThan(0);
    expect(scopes.every((scope) => scope.tenantName === name)).toBe(true);
  });

  // Consent and required-action pages need a signed-in session to reach; the
  // registrations that serve them are held to the spread by reading the
  // composition, as the routes above are by driving it.
  it('spreads the resolver into the consent, login and required-action registrations', async () => {
    const source = await readFile(
      path.resolve(import.meta.dirname, '../../../packages/protocol-oidc/src/index.ts'),
      'utf8',
    );
    const block = (start: string): string => {
      const at = source.indexOf(start);
      expect(at, start).toBeGreaterThan(-1);
      return source.slice(at, source.indexOf('\n    });', at));
    };
    expect(block('registerConsentRoute(app, {')).toContain('...branding');
    expect(block('const loginSubmission = {')).toContain('...branding');
    expect(block('registerRequiredActionRoute(app, {')).toContain('...loginSubmission');
    expect(block('registerLoginRoute(app, {')).toContain('...loginSubmission');
  });
});
