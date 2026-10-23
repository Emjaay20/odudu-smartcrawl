import {
  createDatabase,
  MIGRATIONS_DIR,
  runMigrations,
  type DatabaseHandle,
  tenants,
} from '@odudu/db';
import { capturingSender, emailOutbox, sendPending, type EmailSender } from '@odudu/email';
import { loadConfig, newId } from '@odudu/kernel';
import { createAppRole, startTestDatabase, type TestDatabase } from '@odudu/testkit';
import { eq } from 'drizzle-orm';
import { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '#/app';
import { seed } from '#/cli/seed';
import { createLogger } from '#/logger';

// Recovering an account ends whatever else is signed in to it: the sessions,
// and every grant, offline ones included. Whoever held the account before the
// reset (a person who registered an address that was not theirs, say) holds
// nothing after it, and somebody else's sign-in is left alone.

let containerHandle: TestDatabase | undefined;
let ownerHandle: DatabaseHandle | undefined;
let appHandle: DatabaseHandle | undefined;
let container: TestDatabase;
let owner: DatabaseHandle;
let appDb: DatabaseHandle;

const KEK = Buffer.alloc(32, 7);
const REDIRECT_URI = 'https://app.example/callback';
const PUBLIC_BASE_URL = 'https://idp.example.test';
const PASSWORD = 'correct horse battery staple';
const NEW_PASSWORD = 'a different passphrase, longer';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const FORM = { 'content-type': 'application/x-www-form-urlencoded' };

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
    publicBaseUrl: PUBLIC_BASE_URL,
  });
}

async function drain(into: EmailSender): Promise<void> {
  await sendPending(
    { database: appDb, ownerDatabase: owner, resolveSender: () => Promise.resolve(into) },
    new Date(),
    { batchSize: 50, maxAttempts: 3, retryBackoffSeconds: 60 },
  );
}

const authorizeQuery = (): string =>
  new URLSearchParams({
    response_type: 'code',
    client_id: 'reset-spa',
    redirect_uri: REDIRECT_URI,
    scope: 'openid offline_access',
    state: 'xyz',
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
  }).toString();

interface SignedIn {
  readonly refreshToken: string;
  readonly cookie: string;
}

async function signIn(app: FastifyInstance, tenant: string, username: string): Promise<SignedIn> {
  const page = await app.inject({
    url: `/tenants/${tenant}/protocol/openid-connect/auth?${authorizeQuery()}`,
  });
  const session = /name="auth_session_id" value="([^"]*)"/u.exec(page.body)?.[1] ?? '';
  const login = await app.inject({
    method: 'POST',
    url: `/tenants/${tenant}/login-actions/authenticate`,
    payload: new URLSearchParams({
      auth_session_id: session,
      username,
      password: PASSWORD,
    }).toString(),
    headers: FORM,
  });
  const code = /[?&]code=([^&]*)/u.exec(String(login.headers.location))?.[1];
  const cookie = /[a-z0-9-]+-session=[^;]+/u.exec(
    [login.headers['set-cookie']].flat().join('; '),
  )?.[0];
  if (code === undefined || cookie === undefined) throw new Error('sign-in did not complete');
  const token = await app.inject({
    method: 'POST',
    url: `/tenants/${tenant}/protocol/openid-connect/token`,
    payload: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: 'reset-spa',
      code_verifier: VERIFIER,
    }).toString(),
    headers: FORM,
  });
  const refreshToken = token.json<{ refresh_token?: string }>().refresh_token;
  if (refreshToken === undefined) throw new Error('no refresh token issued');
  return { refreshToken, cookie };
}

function refresh(app: FastifyInstance, tenant: string, refreshToken: string) {
  return app.inject({
    method: 'POST',
    url: `/tenants/${tenant}/protocol/openid-connect/token`,
    payload: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: 'reset-spa',
    }).toString(),
    headers: FORM,
  });
}

describe('a password reset', () => {
  it('ends every session and grant of the account, and leaves another person signed in', async () => {
    const tenant = `reset-${newId()}`;
    const seeded = await seed({
      tenant,
      clientId: 'reset-spa',
      redirectUris: [REDIRECT_URI],
      username: 'ada',
      password: PASSWORD,
      email: 'ada@example.test',
    });
    await seed(['user', '--tenant', tenant, '--username', 'bob', '--password', PASSWORD]);
    await owner.db
      .update(tenants)
      .set({ resetPasswordAllowed: true })
      .where(eq(tenants.id, seeded.tenantId));
    await owner.db.delete(emailOutbox);
    const app = buildTestApp();
    await app.ready();

    try {
      const ada = await signIn(app, tenant, 'ada');
      const bob = await signIn(app, tenant, 'bob');
      expect((await refresh(app, tenant, ada.refreshToken)).statusCode).toBe(200);

      await app.inject({
        method: 'POST',
        url: `/tenants/${tenant}/login-actions/reset-password`,
        payload: new URLSearchParams({ email: 'ada@example.test' }).toString(),
        headers: FORM,
      });
      const sender = capturingSender();
      await drain(sender);
      const key = /[?&]key=([^&\s]+)/u.exec(sender.sent[0]?.text ?? '')?.[1] ?? '';
      const done = await app.inject({
        method: 'POST',
        url: `/tenants/${tenant}/login-actions/action-token`,
        payload: new URLSearchParams({ key, password: NEW_PASSWORD }).toString(),
        headers: FORM,
      });
      expect(done.statusCode).toBe(200);

      // The refresh token held before is dead, and the session cookie no longer
      // signs anybody in without the new password.
      const stale = await refresh(app, tenant, ada.refreshToken);
      expect(stale.statusCode).toBe(400);
      expect(stale.json<{ error: string }>().error).toBe('invalid_grant');
      const silent = await app.inject({
        url: `/tenants/${tenant}/protocol/openid-connect/auth?${authorizeQuery()}`,
        headers: { cookie: ada.cookie },
      });
      expect(silent.statusCode).toBe(200);
      expect(silent.headers.location ?? '').not.toContain('code=');
      expect(silent.body).toContain('name="auth_session_id"');

      // Somebody else's sign-in is untouched.
      expect((await refresh(app, tenant, bob.refreshToken)).statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});
