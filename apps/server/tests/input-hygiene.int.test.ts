import {
  tenants,
  createDatabase,
  MIGRATIONS_DIR,
  runMigrations,
  type DatabaseHandle,
} from '@odudu/db';
import { loadConfig, newId } from '@odudu/kernel';
import { createAppRole, startTestDatabase, type TestDatabase } from '@odudu/testkit';
import { eq } from 'drizzle-orm';
import { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '#/app';
import { seed } from '#/cli/seed';
import { createLogger } from '#/logger';

// Hostile characters in what a person types, through the real composition
// root: none may reach the database as a parameter it cannot hold, and no
// refusal may carry text from the driver.

const PUBLIC_BASE_URL = 'https://idp.example.test';
const REDIRECT_URI = 'https://app.example/callback';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const PASSWORD = 'correct horse battery staple';
const EMAIL = 'ada@example.test';

let containerHandle: TestDatabase | undefined;
let ownerHandle: DatabaseHandle | undefined;
let appHandle: DatabaseHandle | undefined;

let container: TestDatabase;
let owner: DatabaseHandle;
let appDb: DatabaseHandle;

const KEK = Buffer.alloc(32, 11);

beforeAll(async () => {
  containerHandle = await startTestDatabase();
  container = containerHandle;

  ownerHandle = createDatabase(container.adminUrl);
  owner = ownerHandle;
  await runMigrations(owner.db, MIGRATIONS_DIR);

  const appUrl = await createAppRole(container.adminUrl);
  appHandle = createDatabase(appUrl, { max: 5 });
  appDb = appHandle;

  process.env.ODUDU_DATABASE_URL = container.adminUrl;
  process.env.ODUDU_APP_DATABASE_URL = appUrl;
  process.env.ODUDU_KEK = KEK.toString('base64');
  process.env.ODUDU_PUBLIC_BASE_URL = PUBLIC_BASE_URL;
}, 120_000);

afterAll(async () => {
  delete process.env.ODUDU_DATABASE_URL;
  delete process.env.ODUDU_APP_DATABASE_URL;
  delete process.env.ODUDU_KEK;
  delete process.env.ODUDU_PUBLIC_BASE_URL;
  await appHandle?.close();
  await ownerHandle?.close();
  await containerHandle?.stop();
});

function buildTestApp(): FastifyInstance {
  const config = loadConfig({ ...process.env, ODUDU_LOG_LEVEL: 'silent' });
  return buildApp({
    tls: false,
    database: appDb,
    ownerDatabase: owner,
    kek: KEK,
    logger: createLogger(config),
    throttle: { limit: 100_000, windowSeconds: 60 },
    loginThrottle: { limit: 100_000, windowSeconds: 60 },
    ...(config.ODUDU_PUBLIC_BASE_URL !== undefined
      ? { publicBaseUrl: config.ODUDU_PUBLIC_BASE_URL }
      : {}),
  });
}

// Raw, because URLSearchParams would encode a lone surrogate as U+FFFD
// before the server ever saw it.
function rawPost(app: FastifyInstance, url: string, encoded: string) {
  return app.inject({
    method: 'POST',
    url,
    payload: encoded,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
}

const HOSTILE: readonly (readonly [string, string])[] = [
  ['NUL', '%00'],
  ['NUL inside a name', 'a%00b'],
  ['SOH', '%01'],
  ['BS', '%08'],
  ['LF', '%0A'],
  ['US', '%1F'],
  ['DEL', '%7F'],
  ['a lone high surrogate', '%ED%A0%80'],
  ['a lone low surrogate', '%ED%B0%80'],
  ['an over-long value', 'u'.repeat(200_000)],
];

function expectNoLeak(res: { statusCode: number; body: string }): void {
  expect(res.statusCode).toBeLessThan(500);
  expect(res.body).not.toMatch(/Failed query|select |insert |\bparams\b|postgres/iu);
}

let tenantName: string;
let sessionId: string;
let app: FastifyInstance;

async function freshSession(): Promise<string> {
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: 'hygiene-app',
    redirect_uri: REDIRECT_URI,
    scope: 'openid',
    state: 'xyz-123',
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
  });
  const res = await app.inject({
    url: `/tenants/${tenantName}/protocol/openid-connect/auth?${query.toString()}`,
  });
  const id = /name="auth_session_id" value="([^"]*)"/.exec(res.body)?.[1];
  if (id === undefined) throw new Error('no auth_session_id');
  return id;
}

beforeAll(async () => {
  tenantName = `hygiene-${newId()}`;
  const seeded = await seed({
    tenant: tenantName,
    clientId: 'hygiene-app',
    redirectUris: [REDIRECT_URI],
    username: 'ada',
    password: PASSWORD,
    email: EMAIL,
  });
  await owner.db
    .update(tenants)
    .set({ registrationAllowed: true, verifyEmail: false, resetPasswordAllowed: true })
    .where(eq(tenants.id, seeded.tenantId));
  app = buildTestApp();
  await app.ready();
  sessionId = await freshSession();
}, 120_000);

afterAll(async () => {
  await app.close();
});

describe('the sign-in form with hostile input', () => {
  const FIELDS = ['username', 'password', 'code', 'recovery_code'] as const;

  it.each(
    FIELDS.flatMap((field) => HOSTILE.map(([label, value]) => [field, label, value] as const)),
  )('refuses %s holding %s as it refuses any wrong credential', async (field, _label, value) => {
    const fields = {
      username: 'nobody-here',
      password: 'wrong',
    };
    const payload = Object.entries({ ...fields, [field]: '' })
      .filter(([name]) => name !== field)
      .map(([name, text]) => `${name}=${encodeURIComponent(text)}`)
      .concat(`${field}=${value}`)
      .concat(`auth_session_id=${await freshSession()}`)
      .join('&');

    const res = await rawPost(app, `/tenants/${tenantName}/login-actions/authenticate`, payload);

    expectNoLeak(res);
    // A password past the maximum is refused before it is hashed, as ever.
    const tooLong = field === 'password' && value.length > 1000;
    expect(res.statusCode).toBe(tooLong ? 400 : 200);
    if (!tooLong) expect(res.body).toContain('Sign-in failed.');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('gives a neutralised name back as plain text, never as a control character', async () => {
    const res = await rawPost(
      app,
      `/tenants/${tenantName}/login-actions/authenticate`,
      `auth_session_id=${sessionId}&username=ada%00%0A&password=wrong`,
    );

    expectNoLeak(res);
    const echoed = /name="username"[^>]* value="([^"]*)"/u.exec(res.body)?.[1] ?? '';
    expect(echoed).toBe('ada\uFFFD\uFFFD');
  });

  it('refuses the right password with a control character in the name', async () => {
    const res = await rawPost(
      app,
      `/tenants/${tenantName}/login-actions/authenticate`,
      `auth_session_id=${await freshSession()}&username=ada%00&password=${encodeURIComponent(PASSWORD)}`,
    );

    expect(res.statusCode).toBe(200);
    expect(res.headers.location).toBeUndefined();
  });
});

describe('the other login-actions forms with hostile input', () => {
  it.each(HOSTILE)(
    'registration refuses a username, email and password holding %s without a 5xx',
    async (_label, value) => {
      for (const field of ['username', 'email', 'password']) {
        const parts = { username: 'newbie', email: 'newbie@example.test', password: PASSWORD };
        const payload = Object.entries(parts)
          .filter(([name]) => name !== field)
          .map(([name, text]) => `${name}=${encodeURIComponent(text)}`)
          .concat(`${field}=${value}`)
          .join('&');

        expectNoLeak(
          await rawPost(app, `/tenants/${tenantName}/login-actions/registration`, payload),
        );
      }
    },
  );

  it.each(HOSTILE)(
    'reset-password answers an email holding %s without a 5xx',
    async (_label, value) => {
      expectNoLeak(
        await rawPost(app, `/tenants/${tenantName}/login-actions/reset-password`, `email=${value}`),
      );
    },
  );

  it.each(HOSTILE)('action-token answers a key holding %s without a 5xx', async (_label, value) => {
    const post = await rawPost(
      app,
      `/tenants/${tenantName}/login-actions/action-token`,
      `key=${value}&password=${encodeURIComponent(PASSWORD)}`,
    );
    expectNoLeak(post);
    expectNoLeak(
      await app.inject({ url: `/tenants/${tenantName}/login-actions/action-token?key=${value}` }),
    );
  });

  it.each(HOSTILE)(
    'an authorization request with %s in a parameter is not a 5xx',
    async (_label, value) => {
      const query = `response_type=code&client_id=hygiene-app&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=openid&state=${value}&nonce=${value}&code_challenge=${CHALLENGE}&code_challenge_method=S256`;
      expectNoLeak(
        await app.inject({ url: `/tenants/${tenantName}/protocol/openid-connect/auth?${query}` }),
      );
    },
  );

  it.each(HOSTILE)('a tenant name holding %s is an unknown tenant', async (_label, value) => {
    expectNoLeak(
      await rawPost(app, `/tenants/x${value}y/login-actions/authenticate`, 'username=a&password=b'),
    );
    expectNoLeak(await app.inject({ url: `/tenants/x${value}y/.well-known/openid-configuration` }));
  });
});
