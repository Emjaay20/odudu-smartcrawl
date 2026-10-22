import {
  createDatabase,
  MIGRATIONS_DIR,
  runMigrations,
  tenants,
  type DatabaseHandle,
} from '@odudu/db';
import { emailOutbox } from '@odudu/email';
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

// The mail a request queued, as the link it carries.
async function mailedLink(name: string, to: string): Promise<string> {
  const rows = await owner.db
    .select({
      text: emailOutbox.bodyText,
      tenantId: emailOutbox.tenantId,
      to: emailOutbox.toAddress,
    })
    .from(emailOutbox)
    .where(eq(emailOutbox.toAddress, to));
  const text = rows.at(-1)?.text ?? '';
  const link = /https:\/\/idp\.example\.test(\S+)/u.exec(text)?.[1];
  if (link === undefined) throw new Error(`no link mailed to ${to} for ${name}`);
  return link;
}

const RICH = 'state=SECRET-STATE&nonce=SECRET-NONCE&claims=%7B%7D&prompt=login&max_age=0';

describe('the pages a mailed link opens lead back to the same sign-in', () => {
  async function requestFrom(name: string): Promise<string> {
    const query = new URLSearchParams({
      response_type: 'code',
      client_id: 'portal',
      redirect_uri: REDIRECT_URI,
      scope: 'openid',
      code_challenge: CHALLENGE,
      code_challenge_method: 'S256',
    });
    return `/tenants/${name}/protocol/openid-connect/auth?${query.toString()}&${RICH}`;
  }

  it('verifies, then links back; a spent link links back too; the mail holds no state or nonce', async () => {
    const name = await tenant({ registrationAllowed: true, verifyEmail: true });
    const path = await requestFrom(name);
    const email = `v-${newId()}@example.test`;
    const registered = await post(`/tenants/${name}/login-actions/registration`, {
      username: `v${newId().slice(-8)}`,
      email,
      password: 'correct horse battery staple',
      return_to: path,
    });
    expect(registered.statusCode).toBe(201);

    const link = await mailedLink(name, email);
    for (const secret of ['SECRET-STATE', 'SECRET-NONCE', 'claims', 'prompt', 'max_age']) {
      expect(link, secret).not.toContain(secret);
    }
    expect(link).toContain('return_to=');

    const verified = await http.inject({ url: link });
    expect(verified.statusCode).toBe(200);
    const back = hrefLabelled(verified, 'Back to sign in') ?? '';
    expect(back.startsWith(`/tenants/${name}/protocol/openid-connect/auth?`)).toBe(true);
    expect(back).toContain('client_id=portal');
    expect(back).not.toContain('SECRET');
    const restarted = await http.inject({ url: back });
    expect(restarted.statusCode).toBe(200);
    expect(restarted.body).toContain('name="auth_session_id"');

    const spent = await http.inject({ url: link });
    expect(spent.statusCode).toBe(400);
    expect(hrefLabelled(spent, 'Back to sign in')).toBe(back);
  });

  it('shows no way back for a link mailed with none, or with a tampered one', async () => {
    const name = await tenant({ registrationAllowed: true, verifyEmail: true });
    const email = `n-${newId()}@example.test`;
    await post(`/tenants/${name}/login-actions/registration`, {
      username: `n${newId().slice(-8)}`,
      email,
      password: 'correct horse battery staple',
    });
    const link = await mailedLink(name, email);
    expect(link).not.toContain('return_to');
    const tampered = await http.inject({
      url: `${link}&return_to=${encodeURIComponent('https://evil.example/x')}`,
    });
    expect(tampered.body).not.toContain('evil.example');
    expect(tampered.body).not.toContain('Back to sign in');
  });

  it('carries it through a reset: the form, a refusal, the done page and the spent link', async () => {
    const name = await tenant({ resetPasswordAllowed: true });
    const path = await requestFrom(name);
    const email = `r-${newId()}@example.test`;
    await seed({
      tenant: `${name}`,
      clientId: 'reset-user-seed',
      redirectUris: [REDIRECT_URI],
      username: `u${newId().slice(-8)}`,
      password: 'correct horse battery staple',
      email,
    });
    const sent = await post(`/tenants/${name}/login-actions/reset-password`, {
      email,
      return_to: path,
    });
    expect(sent.statusCode).toBe(200);
    const link = await mailedLink(name, email);
    expect(link).toContain('return_to=');
    expect(link).not.toContain('SECRET');

    const form = await http.inject({ url: link });
    expect(form.statusCode).toBe(200);
    const returnTo = /name="return_to" value="([^"]*)"/u.exec(form.body)?.[1] ?? '';
    const key = /name="key" value="([^"]*)"/u.exec(form.body)?.[1] ?? '';
    expect(returnTo).not.toBe('');
    const action = `/tenants/${name}/login-actions/action-token`;

    const weak = await post(action, { key, password: 'zq9xv', return_to: unescapeHtml(returnTo) });
    expect(weak.statusCode).toBe(400);
    expect(weak.body).toContain(`name="return_to" value="${returnTo}"`);

    const done = await post(action, {
      key,
      password: 'a brand new passphrase',
      return_to: unescapeHtml(returnTo),
    });
    expect(done.statusCode).toBe(200);
    expect(hrefLabelled(done, 'Back to sign in')).toBe(unescapeHtml(returnTo));

    const spent = await http.inject({ url: link });
    expect(spent.statusCode).toBe(400);
    expect(spent.body).toContain('Back to sign in');
    expect(spent.body).toContain('Request a new link');
  });

  it('answers a posted dead key with the link-failed page, not the form, whatever was posted', async () => {
    const name = await tenant({ resetPasswordAllowed: true });
    const res = await post(`/tenants/${name}/login-actions/action-token`, {
      key: 'x'.repeat(43),
      password: '',
    });
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('This link can&#39;t be used');
    expect(res.body).not.toContain('<form');
  });
});
