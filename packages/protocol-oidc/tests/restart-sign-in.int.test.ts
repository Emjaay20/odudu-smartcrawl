import { authenticationSessions, provisionTenant } from '@odudu/authn-flows';
import { hashPassword, subjectRepository, userCredentials, users } from '@odudu/domain-identity';
import {
  createDatabase,
  MIGRATIONS_DIR,
  tenants,
  runMigrations,
  withTenant,
  type DatabaseHandle,
} from '@odudu/db';
import { clients, provisionClientDefaults } from '@odudu/domain-tenant';
import { FakeClock, newId } from '@odudu/kernel';
import { createAppRole, startTestDatabase, type TestDatabase } from '@odudu/testkit';
import formbody from '@fastify/formbody';
import { eq } from 'drizzle-orm';
import Fastify, { type FastifyInstance, type LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { oidcRoutes } from '#/index';
import { NO_CLIENT_KEY_FETCHER } from '#/repository/client-keys';
import { clientOidcConfigRepository } from '#/repository/client-oidc-config';
import { UNLIMITED_AUDIT_REFUSAL_BUDGET } from '#/service/audit-refusal-budget';
import { UNLIMITED_CLIENT_SECRET_LIMITER } from '#/service/client-secret-throttle';

const CLIENT_ID = 'restart-client';
const REDIRECT_URI = 'https://app.example/callback';
const USERNAME = 'ada';
const PASSWORD = 'correct horse battery staple';
const KEK = Buffer.alloc(32, 7);
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const EXPIRED_NOTICE = 'This sign-in attempt is no longer valid. Go back and start again.';

let container: TestDatabase;
let owner: DatabaseHandle;
let app: DatabaseHandle;
let http: FastifyInstance;
let clock: FakeClock;

async function setupTenant(name: string): Promise<string> {
  const tenantId = newId();
  const clientDbId = newId();
  await withTenant(app.db, tenantId, async (tx) => {
    await tx.insert(tenants).values({ id: tenantId, name });
    await provisionTenant(tx, tenantId);
    await tx.insert(clients).values({
      id: clientDbId,
      tenantId,
      clientId: CLIENT_ID,
      name: 'Restart client',
      type: 'public',
    });
    await provisionClientDefaults(tx, clientDbId);
    await clientOidcConfigRepository(tx).create({
      clientId: clientDbId,
      tenantId,
      redirectUris: [REDIRECT_URI],
      grantTypes: ['authorization_code'],
      tokenEndpointAuthMethod: 'none',
      audiences: [],
      accessTokenTtlSeconds: 300,
      refreshTokenTtlSeconds: 1_209_600,
    });
    const subject = await subjectRepository(tx).create({ tenantId, type: 'user' });
    await tx.insert(users).values({ subjectId: subject.id, tenantId, username: USERNAME });
    await tx.insert(userCredentials).values({
      id: newId(),
      tenantId,
      subjectId: subject.id,
      type: 'password',
      secretData: { hash: await hashPassword(PASSWORD) },
    });
  });
  return tenantId;
}

function authorizeUrl(tenant: string): string {
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'openid',
    state: 'xyz 123',
    nonce: 'n-1',
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
  });
  return `/tenants/${tenant}/protocol/openid-connect/auth?${query.toString()}`;
}

function authSessionIdOf(res: LightMyRequestResponse): string {
  const id = /name="auth_session_id" value="([^"]*)"/.exec(res.body)?.[1];
  if (id === undefined) throw new Error('no auth_session_id in the page');
  return id;
}

function submit(tenant: string, fields: Record<string, string>): Promise<LightMyRequestResponse> {
  return http.inject({
    method: 'POST',
    url: `/tenants/${tenant}/login-actions/authenticate`,
    payload: new URLSearchParams(fields).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
}

// The same request, whatever order its parameters came in.
function asRequest(location: string | undefined): { path: string; params: Record<string, string> } {
  const url = new URL(location ?? 'x:', 'https://server.example');
  return { path: url.pathname, params: Object.fromEntries(url.searchParams) };
}

function restartHref(res: LightMyRequestResponse): string | undefined {
  const raw = /<a href="([^"]*)">Start sign-in again<\/a>/.exec(res.body)?.[1];
  return raw?.replaceAll('&amp;', '&');
}

beforeAll(async () => {
  container = await startTestDatabase();
  owner = createDatabase(container.adminUrl);
  await runMigrations(owner.db, MIGRATIONS_DIR);
  app = createDatabase(await createAppRole(container.adminUrl), { max: 5 });
  clock = new FakeClock(new Date());
  http = Fastify();
  await http.register(formbody);
  await http.register(
    oidcRoutes({
      database: app,
      ownerDatabase: owner,
      kek: KEK,
      clientSecretLimiter: UNLIMITED_CLIENT_SECRET_LIMITER,
      auditRefusalBudget: UNLIMITED_AUDIT_REFUSAL_BUDGET,
      clientKeySet: NO_CLIENT_KEY_FETCHER,
      clock,
    }),
  );
  await http.ready();
}, 120_000);

afterAll(async () => {
  await http.close();
  await app.close();
  await owner.close();
  await container.stop();
});

describe('a login form restored by the browser after Back', () => {
  it('is never cached, and reloads itself when the page cache restores it', async () => {
    const name = `acme-restore-${newId()}`;
    await setupTenant(name);
    const res = await http.inject({ url: authorizeUrl(name) });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    const nonce = /<script nonce="([^"]+)">[^<]*pageshow[^<]*<\/script>/.exec(res.body)?.[1];
    expect(nonce).toBeDefined();
    expect(String(res.headers['content-security-policy'])).toContain(
      `script-src 'nonce-${nonce ?? ''}'`,
    );
  });

  it('is not given the script when the page answers a POST, which a reload would resend', async () => {
    const name = `acme-post-${newId()}`;
    await setupTenant(name);
    const form = await http.inject({ url: authorizeUrl(name) });
    const rejected = await submit(name, {
      auth_session_id: authSessionIdOf(form),
      username: USERNAME,
      password: 'wrong',
    });
    expect(rejected.statusCode).toBe(200);
    expect(rejected.body).toContain('auth_session_id');
    expect(rejected.body).not.toContain('<script');
    expect(rejected.headers['cache-control']).toBe('no-store');
  });

  it('is not given the script when the authorization request itself was a POST', async () => {
    const name = `acme-postauth-${newId()}`;
    await setupTenant(name);
    const [path, query] = authorizeUrl(name).split('?');
    const res = await http.inject({
      method: 'POST',
      url: path ?? '',
      payload: query ?? '',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('auth_session_id');
    expect(res.body).not.toContain('<script');
  });
});

describe('a sign-in that expired while its form was open', () => {
  it('offers to start again, and the link yields a form that signs in', async () => {
    const name = `acme-expired-${newId()}`;
    await setupTenant(name);
    const form = await http.inject({ url: authorizeUrl(name) });
    const stale = authSessionIdOf(form);
    clock.advance(31 * 60_000);

    const refused = await submit(name, {
      auth_session_id: stale,
      username: USERNAME,
      password: PASSWORD,
    });
    expect(refused.statusCode).toBe(400);
    expect(refused.body).toContain(EXPIRED_NOTICE);
    expect(refused.body).not.toContain('<script');
    expect(refused.headers.location).toBeUndefined();

    const href = restartHref(refused);
    expect(asRequest(href)).toEqual(asRequest(authorizeUrl(name)));

    const fresh = await http.inject({ url: href ?? '' });
    expect(fresh.statusCode).toBe(200);
    const next = authSessionIdOf(fresh);
    expect(next).not.toBe(stale);
    const signedIn = await submit(name, {
      auth_session_id: next,
      username: USERNAME,
      password: PASSWORD,
    });
    expect(signedIn.statusCode).toBe(302);
    const location = new URL(String(signedIn.headers.location));
    expect(location.origin + location.pathname).toBe(REDIRECT_URI);
    expect(location.searchParams.get('state')).toBe('xyz 123');
    expect(location.searchParams.get('code')).toBeTruthy();
  });

  it('offers the link on a consent, required-action or chooser submission too', async () => {
    const name = `acme-other-doors-${newId()}`;
    await setupTenant(name);
    const stale = authSessionIdOf(await http.inject({ url: authorizeUrl(name) }));
    clock.advance(31 * 60_000);
    for (const path of ['consent', 'select-account']) {
      const res = await http.inject({
        method: 'POST',
        url: `/tenants/${name}/login-actions/${path}`,
        payload: new URLSearchParams({ auth_session_id: stale, decision: 'allow' }).toString(),
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      });
      expect(res.statusCode).toBe(400);
      expect(asRequest(restartHref(res))).toEqual(asRequest(authorizeUrl(name)));
    }
    const action = await http.inject({
      method: 'POST',
      url: `/tenants/${name}/login-actions/required-action?action=update-password`,
      payload: new URLSearchParams({ auth_session_id: stale }).toString(),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(action.statusCode).toBe(400);
    expect(asRequest(restartHref(action))).toEqual(asRequest(authorizeUrl(name)));
  });

  it('keeps the generic text once the reaper has deleted the row', async () => {
    const name = `acme-reaped-${newId()}`;
    await setupTenant(name);
    const stale = authSessionIdOf(await http.inject({ url: authorizeUrl(name) }));
    clock.advance(31 * 60_000);
    await owner.db.delete(authenticationSessions).where(eq(authenticationSessions.id, stale));

    const refused = await submit(name, {
      auth_session_id: stale,
      username: USERNAME,
      password: PASSWORD,
    });
    expect(refused.statusCode).toBe(400);
    expect(refused.body).toContain(EXPIRED_NOTICE);
    expect(refused.body).not.toContain('<a ');
  });

  it('offers nothing for an id that names no session, or a malformed one', async () => {
    const name = `acme-unknown-${newId()}`;
    await setupTenant(name);
    for (const id of [newId(), 'not-a-uuid', '']) {
      const refused = await submit(name, {
        auth_session_id: id,
        username: USERNAME,
        password: PASSWORD,
      });
      expect(refused.statusCode).toBe(400);
      expect(refused.body).toContain(EXPIRED_NOTICE);
      expect(refused.body).not.toContain('<a ');
    }
  });

  it("offers nothing for another tenant's session id", async () => {
    const mine = `acme-mine-${newId()}`;
    const theirs = `acme-theirs-${newId()}`;
    await setupTenant(mine);
    await setupTenant(theirs);
    const foreign = authSessionIdOf(await http.inject({ url: authorizeUrl(theirs) }));
    clock.advance(31 * 60_000);
    const refused = await submit(mine, {
      auth_session_id: foreign,
      username: USERNAME,
      password: PASSWORD,
    });
    expect(refused.statusCode).toBe(400);
    expect(refused.body).not.toContain('<a ');
  });

  it('offers nothing for a request that was constrained to one subject', async () => {
    const name = `acme-hint-${newId()}`;
    const tenantId = await setupTenant(name);
    const id = newId();
    await owner.db.insert(authenticationSessions).values({
      id,
      tenantId,
      pendingRequest: {
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
        scope: 'openid',
        state: null,
        nonce: null,
        codeChallenge: CHALLENGE,
        codeChallengeMethod: 'S256',
        idTokenHintSubject: newId(),
      },
      expiresAt: new Date(clock.now().getTime() - 60_000),
    });
    const refused = await submit(name, {
      auth_session_id: id,
      username: USERNAME,
      password: PASSWORD,
    });
    expect(refused.statusCode).toBe(400);
    expect(refused.body).toContain(EXPIRED_NOTICE);
    expect(refused.body).not.toContain('<a ');
  });
});
