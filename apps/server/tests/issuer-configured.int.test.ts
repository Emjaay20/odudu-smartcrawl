import { createDatabase, MIGRATIONS_DIR, runMigrations, type DatabaseHandle } from '@odudu/db';
import { loadConfig, newId } from '@odudu/kernel';
import { createAppRole, startTestDatabase, type TestDatabase } from '@odudu/testkit';
import { type FastifyInstance, type LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '#/app';
import { seed } from '#/cli/seed';
import { createLogger } from '#/logger';

// The issuer is the configured public address, never a request header: the
// discovery document, the `iss` of the authorization response and the `iss`
// of the ID token all state it, whatever Host the request arrives with.

let container: TestDatabase;
let owner: DatabaseHandle;
let appDb: DatabaseHandle;
const apps: FastifyInstance[] = [];

const KEK = Buffer.alloc(32, 7);
const BASE = 'https://id.example.com';
const REDIRECT_URI = 'https://app.example/callback';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
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
}, 120_000);

afterAll(async () => {
  for (const app of apps) await app.close();
  delete process.env.ODUDU_DATABASE_URL;
  delete process.env.ODUDU_APP_DATABASE_URL;
  delete process.env.ODUDU_KEK;
  await appDb.close();
  await owner.close();
  await container.stop();
});

async function start(publicBaseUrl: string | undefined): Promise<FastifyInstance> {
  const config = loadConfig({ ...process.env, ODUDU_LOG_LEVEL: 'silent' });
  const app = buildApp({
    database: appDb,
    ownerDatabase: owner,
    kek: KEK,
    logger: createLogger(config),
    tls: false,
    ...(publicBaseUrl === undefined ? {} : { publicBaseUrl }),
    throttle: { limit: 100_000, windowSeconds: 60 },
  });
  await app.ready();
  apps.push(app);
  return app;
}

async function tenantWithUser(): Promise<{ name: string; username: string }> {
  const name = `iss-${newId()}`;
  const username = `u${newId().slice(-8)}`;
  await seed({
    tenant: name,
    clientId: 'portal',
    redirectUris: [REDIRECT_URI],
    username,
    password: PASSWORD,
  });
  return { name, username };
}

async function signIn(
  app: FastifyInstance,
  host: string,
  tenant: { name: string; username: string },
): Promise<{ location: URL; page: LightMyRequestResponse }> {
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: 'portal',
    redirect_uri: REDIRECT_URI,
    scope: 'openid',
    state: 's',
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
  });
  const page = await app.inject({
    url: `/tenants/${tenant.name}/protocol/openid-connect/auth?${query.toString()}`,
    headers: { host },
  });
  const sessionId = /name="auth_session_id" value="([^"]*)"/u.exec(page.body)?.[1] ?? '';
  const done = await app.inject({
    method: 'POST',
    url: `/tenants/${tenant.name}/login-actions/authenticate`,
    payload: new URLSearchParams({
      auth_session_id: sessionId,
      username: tenant.username,
      password: PASSWORD,
    }).toString(),
    headers: { host, 'content-type': 'application/x-www-form-urlencoded' },
  });
  expect(done.statusCode).toBe(302);
  return { location: new URL(String(done.headers.location)), page };
}

describe('with ODUDU_PUBLIC_BASE_URL set', () => {
  it('states the configured issuer in discovery whatever Host arrives', async () => {
    const app = await start(BASE);
    const { name } = await tenantWithUser();
    for (const host of ['evil.example', 'id.example.com:8443', 'localhost:3000']) {
      const res = await app.inject({
        url: `/tenants/${name}/.well-known/openid-configuration`,
        headers: { host },
      });
      const doc = res.json<{ issuer: string; token_endpoint: string; jwks_uri: string }>();
      expect(doc.issuer, host).toBe(`${BASE}/tenants/${name}`);
      expect(doc.token_endpoint).toBe(`${BASE}/tenants/${name}/protocol/openid-connect/token`);
      expect(doc.jwks_uri.startsWith(`${BASE}/`)).toBe(true);
      expect(res.body).not.toContain('evil.example');
    }
  });

  it('puts the configured issuer in the authorization response and the ID token', async () => {
    const app = await start(BASE);
    const tenant = await tenantWithUser();
    const { location } = await signIn(app, 'evil.example', tenant);
    expect(location.searchParams.get('iss')).toBe(`${BASE}/tenants/${tenant.name}`);

    const token = await app.inject({
      method: 'POST',
      url: `/tenants/${tenant.name}/protocol/openid-connect/token`,
      payload: new URLSearchParams({
        grant_type: 'authorization_code',
        code: location.searchParams.get('code') ?? '',
        redirect_uri: REDIRECT_URI,
        client_id: 'portal',
        code_verifier: VERIFIER,
      }).toString(),
      headers: { host: 'another.example', 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(token.statusCode).toBe(200);
    const idToken = token.json<{ id_token: string }>().id_token;
    const claims = JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString()) as {
      iss: string;
    };
    expect(claims.iss).toBe(`${BASE}/tenants/${tenant.name}`);
  });

  it('serves a tenant only under its own name: another tenant gets its own issuer, not the first', async () => {
    const app = await start(BASE);
    const a = await tenantWithUser();
    const b = await tenantWithUser();
    const issuerOf = async (name: string): Promise<string> => {
      const res = await app.inject({
        url: `/tenants/${name}/.well-known/openid-configuration`,
        headers: { host: 'evil.example' },
      });
      return res.json<{ issuer: string }>().issuer;
    };
    expect(await issuerOf(a.name)).toBe(`${BASE}/tenants/${a.name}`);
    expect(await issuerOf(b.name)).toBe(`${BASE}/tenants/${b.name}`);
  });
});

describe('with ODUDU_PUBLIC_BASE_URL unset', () => {
  it('reads the issuer off the request, as local development always did', async () => {
    const app = await start(undefined);
    const { name } = await tenantWithUser();
    const res = await app.inject({
      url: `/tenants/${name}/.well-known/openid-configuration`,
      headers: { host: 'localhost:3000' },
    });
    expect(res.json<{ issuer: string }>().issuer).toBe(`http://localhost:3000/tenants/${name}`);
  });
});
