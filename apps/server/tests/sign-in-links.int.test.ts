import {
  createDatabase,
  MIGRATIONS_DIR,
  runMigrations,
  tenants,
  type DatabaseHandle,
} from '@odudu/db';
import { authenticationSessions } from '@odudu/authn-flows';
import { loadConfig, newId } from '@odudu/kernel';
import { createAppRole, startTestDatabase, type TestDatabase } from '@odudu/testkit';
import { eq } from 'drizzle-orm';
import { type FastifyInstance, type LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '#/app';
import { seed } from '#/cli/seed';
import { createLogger } from '#/logger';

// The sign-in page, the registration and password-reset pages and the way
// back, through the real composition root: each link is offered on the
// tenant's own settings, carries the request being signed in to, and leads
// only to a path on this server.

let container: TestDatabase;
let owner: DatabaseHandle;
let appDb: DatabaseHandle;
let http: FastifyInstance;

const KEK = Buffer.alloc(32, 7);
const REDIRECT_URI = 'https://app.example/callback';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

beforeAll(async () => {
  container = await startTestDatabase();
  owner = createDatabase(container.adminUrl);
  await runMigrations(owner.db, MIGRATIONS_DIR);
  const appUrl = await createAppRole(container.adminUrl);
  appDb = createDatabase(appUrl, { max: 5 });
  process.env.ODUDU_DATABASE_URL = container.adminUrl;
  process.env.ODUDU_APP_DATABASE_URL = appUrl;
  process.env.ODUDU_KEK = KEK.toString('base64');
  process.env.ODUDU_PUBLIC_BASE_URL = 'https://idp.example.test';
  const config = loadConfig({ ...process.env, ODUDU_LOG_LEVEL: 'silent' });
  http = buildApp({
    database: appDb,
    ownerDatabase: owner,
    kek: KEK,
    logger: createLogger(config),
    publicBaseUrl: 'https://idp.example.test',
    throttle: { limit: 100_000, windowSeconds: 60 },
  });
  await http.ready();
}, 120_000);

afterAll(async () => {
  await http.close();
  delete process.env.ODUDU_DATABASE_URL;
  delete process.env.ODUDU_APP_DATABASE_URL;
  delete process.env.ODUDU_KEK;
  delete process.env.ODUDU_PUBLIC_BASE_URL;
  await appDb.close();
  await owner.close();
  await container.stop();
});

async function tenant(settings: {
  registrationAllowed?: boolean;
  resetPasswordAllowed?: boolean;
  verifyEmail?: boolean;
}): Promise<string> {
  const name = `links-${newId()}`;
  const seeded = await seed({ tenant: name, clientId: 'portal', redirectUris: [REDIRECT_URI] });
  await owner.db
    .update(tenants)
    .set({
      registrationAllowed: false,
      resetPasswordAllowed: false,
      verifyEmail: false,
      ...settings,
    })
    .where(eq(tenants.id, seeded.tenantId));
  return name;
}

function authorizeUrl(name: string): string {
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: 'portal',
    redirect_uri: REDIRECT_URI,
    scope: 'openid',
    state: 'xyz 123',
    nonce: 'n-1',
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
  });
  return `/tenants/${name}/protocol/openid-connect/auth?${query.toString()}`;
}

function unescapeHtml(value: string): string {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');
}

function hrefLabelled(res: LightMyRequestResponse, label: string): string | undefined {
  const escaped = label.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const raw = new RegExp(`<a href="([^"]*)">${escaped}</a>`, 'u').exec(res.body)?.[1];
  return raw === undefined ? undefined : unescapeHtml(raw);
}

function authSessionIdOf(res: LightMyRequestResponse): string {
  const id = /name="auth_session_id" value="([^"]*)"/u.exec(res.body)?.[1];
  if (id === undefined) throw new Error('no auth_session_id in the page');
  return id;
}

function post(url: string, fields: Record<string, string>): Promise<LightMyRequestResponse> {
  return http.inject({
    method: 'POST',
    url,
    payload: new URLSearchParams(fields).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
}

function sameRequest(a: string, b: string): void {
  const [one, other] = [new URL(a, 'https://x'), new URL(b, 'https://x')];
  expect(one.pathname).toBe(other.pathname);
  expect(Object.fromEntries(one.searchParams)).toEqual(Object.fromEntries(other.searchParams));
}

describe('the sign-in page offers the pages the tenant serves', () => {
  it.each([
    ['neither', {}, false, false],
    ['registration only', { registrationAllowed: true }, true, false],
    ['reset only', { resetPasswordAllowed: true }, false, true],
    ['both', { registrationAllowed: true, resetPasswordAllowed: true }, true, true],
  ])('with %s allowed', async (_label, settings, create, reset) => {
    const name = await tenant(settings);
    const page = await http.inject({ url: authorizeUrl(name) });
    expect(page.statusCode).toBe(200);
    expect(hrefLabelled(page, 'Create an account') !== undefined).toBe(create);
    expect(hrefLabelled(page, 'Forgot password?') !== undefined).toBe(reset);
    // What is offered is served: the same settings answer 404 on the page.
    for (const [path, offered] of [
      ['registration', create],
      ['reset-password', reset],
    ] as const) {
      const served = await http.inject({ url: `/tenants/${name}/login-actions/${path}` });
      expect(served.statusCode === 200, path).toBe(offered);
    }
  });

  it('carries the request being signed in to, and keeps the links after a refused sign-in', async () => {
    const name = await tenant({ registrationAllowed: true, resetPasswordAllowed: true });
    const first = await http.inject({ url: authorizeUrl(name) });
    const create = hrefLabelled(first, 'Create an account') ?? '';
    const returnTo = new URL(create, 'https://x').searchParams.get('return_to') ?? '';
    expect(returnTo.startsWith(`/tenants/${name}/protocol/openid-connect/auth?`)).toBe(true);
    sameRequest(returnTo, authorizeUrl(name));
    expect(create).not.toContain(authSessionIdOf(first));

    const refused = await post(`/tenants/${name}/login-actions/authenticate`, {
      auth_session_id: authSessionIdOf(first),
      username: 'nobody',
      password: 'wrong',
    });
    expect(refused.statusCode).toBe(200);
    expect(refused.body).toContain('id="form-error"');
    expect(hrefLabelled(refused, 'Create an account')).toBe(create);
    expect(hrefLabelled(refused, 'Forgot password?')).toBeDefined();
  });
});

describe('the way through registration and back', () => {
  it('opens from the sign-in page, refuses in place, succeeds, and returns to the same request', async () => {
    const name = await tenant({ registrationAllowed: true });
    const login = await http.inject({ url: authorizeUrl(name) });
    const create = hrefLabelled(login, 'Create an account') ?? '';

    const form = await http.inject({ url: create });
    expect(form.statusCode).toBe(200);
    const back = hrefLabelled(form, 'Back to sign in') ?? '';
    sameRequest(back, authorizeUrl(name));

    const refused = await post(`/tenants/${name}/login-actions/registration`, {
      username: 'ada',
      email: 'ada@example.test',
      password: 'zq9xv',
      return_to: back,
    });
    expect(refused.statusCode).toBe(400);
    expect(refused.body).toContain('<form method="post"');
    expect(refused.body).toContain('value="ada"');
    expect(refused.body).not.toContain('zq9xv');
    expect(hrefLabelled(refused, 'Back to sign in')).toBe(back);

    const done = await post(`/tenants/${name}/login-actions/registration`, {
      username: 'ada',
      email: 'ada@example.test',
      password: 'correct horse battery staple',
      return_to: back,
    });
    expect(done.statusCode).toBe(201);
    const onward = hrefLabelled(done, 'Back to sign in') ?? '';
    const again = await http.inject({ url: onward });
    expect(again.statusCode).toBe(200);
    expect(again.body).toContain('name="auth_session_id"');
    expect(again.body).toContain('to continue to');
  });

  it('starts a new request from the carried path when the original parked one is gone', async () => {
    const name = await tenant({ registrationAllowed: true });
    const [{ id: tenantId } = { id: '' }] = await owner.db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.name, name));
    const login = await http.inject({ url: authorizeUrl(name) });
    const create = hrefLabelled(login, 'Create an account') ?? '';
    const form = await http.inject({ url: create });
    const back = hrefLabelled(form, 'Back to sign in') ?? '';

    // The parked request lives thirty minutes; here it is gone altogether.
    await owner.db
      .delete(authenticationSessions)
      .where(eq(authenticationSessions.tenantId, tenantId));

    const again = await http.inject({ url: back });
    expect(again.statusCode).toBe(200);
    const fresh = /name="auth_session_id" value="([^"]*)"/u.exec(again.body)?.[1];
    expect(fresh).toBeDefined();
    expect(fresh).not.toBe(authSessionIdOf(login));
    expect(again.body).toContain('to continue to');
  });

  it('offers no way back on a direct visit', async () => {
    const name = await tenant({ registrationAllowed: true, resetPasswordAllowed: true });
    for (const path of ['registration', 'reset-password']) {
      const res = await http.inject({ url: `/tenants/${name}/login-actions/${path}` });
      expect(res.statusCode).toBe(200);
      expect(res.body).not.toContain('Back to sign in');
    }
  });

  it('does not carry one tenant request into another tenant or to a foreign address', async () => {
    const a = await tenant({ registrationAllowed: true, resetPasswordAllowed: true });
    const b = await tenant({ registrationAllowed: true, resetPasswordAllowed: true });
    const fromA = await http.inject({ url: authorizeUrl(a) });
    const returnToA =
      new URL(hrefLabelled(fromA, 'Create an account') ?? '', 'https://x').searchParams.get(
        'return_to',
      ) ?? '';

    const intoB = await http.inject({
      url: `/tenants/${b}/login-actions/registration?${new URLSearchParams({ return_to: returnToA }).toString()}`,
    });
    expect(intoB.statusCode).toBe(200);
    expect(intoB.body).not.toContain('Back to sign in');
    expect(intoB.body).not.toContain(`/tenants/${a}/`);

    for (const bad of ['https://evil.example/x', '//evil.example/x', 'javascript:alert(1)']) {
      const res = await post(`/tenants/${a}/login-actions/reset-password`, {
        email: 'x@example.test',
        return_to: bad,
      });
      expect(res.body, bad).not.toContain('evil.example');
      expect(res.body, bad).not.toContain('Back to sign in');
    }
  });
});

describe('the way through password reset and back', () => {
  it('opens from the sign-in page and returns to the same request from the sent page', async () => {
    const name = await tenant({ resetPasswordAllowed: true });
    const login = await http.inject({ url: authorizeUrl(name) });
    const reset = hrefLabelled(login, 'Forgot password?') ?? '';

    const form = await http.inject({ url: reset });
    expect(form.statusCode).toBe(200);
    const back = hrefLabelled(form, 'Back to sign in') ?? '';
    sameRequest(back, authorizeUrl(name));

    const empty = await post(`/tenants/${name}/login-actions/reset-password`, {
      email: '',
      return_to: back,
    });
    expect(empty.statusCode).toBe(400);
    expect(empty.body).toContain('<form method="post"');
    expect(hrefLabelled(empty, 'Back to sign in')).toBe(back);

    const sent = await post(`/tenants/${name}/login-actions/reset-password`, {
      email: 'nobody@example.test',
      return_to: back,
    });
    expect(sent.statusCode).toBe(200);
    expect(hrefLabelled(sent, 'Back to sign in')).toBe(back);
  });
});
