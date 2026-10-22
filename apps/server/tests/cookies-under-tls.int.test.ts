import {
  createDatabase,
  MIGRATIONS_DIR,
  runMigrations,
  tenants,
  type DatabaseHandle,
} from '@odudu/db';
import { loadConfig, newId } from '@odudu/kernel';
import { createAppRole, startTestDatabase, type TestDatabase } from '@odudu/testkit';
import { eq } from 'drizzle-orm';
import { type LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest';
import { provisionConsole } from '#/cli/console';
import { seed, seedAdmin } from '#/cli/seed';
import { CONSOLE_CLIENT_KEY, CONSOLE_KEYS } from '#/testing/console-key';
import {
  browse,
  field,
  Jar,
  KEK,
  post,
  signIn,
  startConsoleApp,
  type ConsoleStack,
} from '#/testing/console-harness';

// The app built the way serve.ts builds it (appDepsFromConfig), with
// ODUDU_TLS=true behind a proxy, and every cookie a real flow sets read off
// the wire: each takes its prefix, Secure and its scope from the one setting.

let container: TestDatabase;
let owner: DatabaseHandle;
let appDb: DatabaseHandle;

const PLAIN_BASE = 'http://console.example.test';
const TLS_BASE = 'https://console.example.test';
const REDIRECT_URI = 'https://app.example/callback';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const PASSWORD = 'correct horse battery staple';

beforeAll(async () => {
  container = await startTestDatabase();
  owner = createDatabase(container.adminUrl);
  await runMigrations(owner.db, MIGRATIONS_DIR);
  const appUrl = await createAppRole(container.adminUrl);
  appDb = createDatabase(appUrl, { max: 5 });
  process.env.ODUDU_DATABASE_URL = container.adminUrl;
  process.env.ODUDU_APP_DATABASE_URL = appUrl;
  process.env.ODUDU_KEK = KEK.toString('base64');
  process.env.ODUDU_CONSOLE_CLIENT_KEY = CONSOLE_CLIENT_KEY;
  process.env.ODUDU_PUBLIC_BASE_URL = PLAIN_BASE;
  await seedAdmin({ username: `setup-${newId()}` });
}, 120_000);

afterAll(async () => {
  delete process.env.ODUDU_DATABASE_URL;
  delete process.env.ODUDU_APP_DATABASE_URL;
  delete process.env.ODUDU_KEK;
  delete process.env.ODUDU_CONSOLE_CLIENT_KEY;
  delete process.env.ODUDU_PUBLIC_BASE_URL;
  await appDb.close();
  await owner.close();
  await container.stop();
});

function setCookies(res: LightMyRequestResponse): string[] {
  const header = res.headers['set-cookie'];
  if (header === undefined) return [];
  return Array.isArray(header) ? header : [header];
}

function configFor(tls: boolean, base: string) {
  return loadConfig({
    ...process.env,
    ODUDU_LOG_LEVEL: 'silent',
    ODUDU_TLS: String(tls),
    ODUDU_TRUST_PROXY: String(base.startsWith('https:')),
    ODUDU_PUBLIC_BASE_URL: base,
  });
}

async function withApp(tls: boolean, run: (stack: ConsoleStack) => Promise<void>): Promise<void> {
  const base = tls ? TLS_BASE : PLAIN_BASE;
  const databases = { database: appDb, ownerDatabase: owner };
  if (tls) {
    onTestFinished(async () => {
      process.env.ODUDU_PUBLIC_BASE_URL = PLAIN_BASE;
      await provisionConsole(databases, {
        consoleBaseUrl: PLAIN_BASE,
        consoleClientJwks: CONSOLE_KEYS.jwks,
      });
    });
    process.env.ODUDU_PUBLIC_BASE_URL = TLS_BASE;
    await provisionConsole(databases, {
      consoleBaseUrl: TLS_BASE,
      consoleClientJwks: CONSOLE_KEYS.jwks,
    });
  }
  const stack = await startConsoleApp(databases, base, { config: configFor(tls, base) });
  try {
    await run(stack);
  } finally {
    await stack.app.close();
  }
}

async function tenantWithUser(): Promise<{ name: string; username: string }> {
  const name = `tls-${newId()}`;
  const username = `u${newId().slice(-8)}`;
  const seeded = await seed({
    tenant: name,
    clientId: 'portal',
    redirectUris: [REDIRECT_URI],
    username,
    password: PASSWORD,
  });
  await owner.db
    .update(tenants)
    .set({ rememberMeAllowed: true })
    .where(eq(tenants.id, seeded.tenantId));
  return { name, username };
}

function authorizePath(name: string): string {
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: 'portal',
    redirect_uri: REDIRECT_URI,
    scope: 'openid',
    state: 's',
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
  });
  return `/tenants/${name}/protocol/openid-connect/auth?${query.toString()}`;
}

const SECURE = (tls: boolean): string => (tls ? '; Secure' : '');

describe.each([
  ['TLS', true],
  ['plain HTTP', false],
])('under %s', (_label, tls) => {
  const session = (name: string): string => (tls ? `__Host-${name}-session` : `${name}-session`);

  it('sets the sign-in handle scoped to the tenant', async () => {
    await withApp(tls, async (stack) => {
      const { name } = await tenantWithUser();
      const res = await browse(stack, new Jar(), authorizePath(name));
      const [handle] = setCookies(res);
      const prefix = tls ? '__Secure-odudu-sign-in' : 'odudu-sign-in';
      expect(handle).toMatch(
        new RegExp(
          `^${prefix}=[0-9a-f-]{36}\\.[A-Za-z0-9_-]{43}; HttpOnly; SameSite=Lax; Path=/tenants/${name}/${SECURE(tls)}; Max-Age=1800$`,
          'u',
        ),
      );
    });
  });

  it('sets the session, the remember-me cookie and the expiry of the handle on sign-in, and clears the session on logout', async () => {
    await withApp(tls, async (stack) => {
      const { name, username } = await tenantWithUser();
      const jar = new Jar();
      const form = await browse(stack, jar, authorizePath(name));
      const signedIn = await post(stack, jar, `/tenants/${name}/login-actions/authenticate`, {
        auth_session_id: field(form.body, 'auth_session_id'),
        username,
        password: PASSWORD,
        remember_me: 'true',
      });
      expect(signedIn.statusCode).toBe(302);
      const cookies = setCookies(signedIn);
      expect(cookies).toContainEqual(
        expect.stringMatching(
          new RegExp(
            `^${session(name)}-persistent=[0-9a-f-]{36}:[A-Za-z0-9_-]{43}; HttpOnly; SameSite=Lax; Path=/${SECURE(tls)}; Max-Age=\\d+$`,
            'u',
          ),
        ),
      );
      expect(cookies).toContain(
        `${session(name)}=; HttpOnly; SameSite=Lax; Path=/${SECURE(tls)}; Max-Age=0`,
      );
      expect(cookies).toContain(
        `${tls ? '__Secure-odudu-sign-in' : 'odudu-sign-in'}=; HttpOnly; SameSite=Lax; Path=/tenants/${name}/${SECURE(tls)}; Max-Age=0`,
      );

      const confirm = await browse(stack, jar, `/tenants/${name}/protocol/openid-connect/logout`);
      expect(confirm.statusCode).toBe(200);
      const fields: Record<string, string> = {};
      for (const match of confirm.body.matchAll(
        /<input type="hidden" name="([^"]+)" value="([^"]*)">/gu,
      )) {
        fields[match[1] ?? ''] = match[2] ?? '';
      }
      const ended = await post(
        stack,
        jar,
        `/tenants/${name}/protocol/openid-connect/logout`,
        fields,
      );
      const cleared = setCookies(ended);
      expect(cleared).toContain(
        `${session(name)}=; HttpOnly; SameSite=Lax; Path=/${SECURE(tls)}; Max-Age=0`,
      );
      expect(cleared).toContain(
        `${session(name)}-persistent=; HttpOnly; SameSite=Lax; Path=/${SECURE(tls)}; Max-Age=0`,
      );
    });
  });

  it('sets the console cookies on login, and clears them on logout', async () => {
    await withApp(tls, async (stack) => {
      const jar = new Jar();
      const login = await browse(
        stack,
        jar,
        '/console/auth/login?tenant=system&return_to=/console/x',
      );
      const prefix = tls ? '__Host-odudu-console' : 'odudu-console';
      expect(setCookies(login)).toContainEqual(
        expect.stringMatching(
          new RegExp(
            `^${prefix}-login=[^;]+; HttpOnly; SameSite=Lax; Path=/; Max-Age=\\d+${SECURE(tls)}$`,
            'u',
          ),
        ),
      );

      const { response } = await signIn(stack, new Jar());
      expect(setCookies(response)).toContainEqual(
        expect.stringMatching(
          new RegExp(
            `^${prefix}=[0-9a-f-]{36}\\.[A-Za-z0-9_-]{43}; HttpOnly; SameSite=Strict; Path=/${SECURE(tls)}$`,
            'u',
          ),
        ),
      );

      const own = new Jar();
      await signIn(stack, own);
      const out = await stack.app.inject({
        method: 'POST',
        url: '/console/auth/logout',
        headers: {
          host: stack.base.host,
          origin: stack.base.origin,
          'x-odudu-console': '1',
          ...(tls ? { 'x-forwarded-proto': 'https' } : {}),
          ...own.header(),
        },
      });
      expect(setCookies(out)).toContain(
        `${prefix}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${SECURE(tls)}`,
      );
    });
  });
});
