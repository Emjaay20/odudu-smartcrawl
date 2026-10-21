// Calls the running API with the tokens Odudu issues. Needs a stack provisioned
// by ../_shared/provision.sh. The checks on a token that is wrong in some way
// are in verifier.test.ts.
import assert from 'node:assert/strict';
import { type ChildProcess, spawn } from 'node:child_process';
import { after, before, test } from 'node:test';

const BASE = process.env.ODUDU_BASE ?? 'http://localhost:3000';
const ISSUER = `${BASE}/tenants/${process.env.TENANT ?? 'demo'}`;
const TOKEN_URL = `${ISSUER}/protocol/openid-connect/token`;
const servers: ChildProcess[] = [];

async function waitFor(url: string): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`${url} never answered`);
}

async function start(port: string, audience: string): Promise<string> {
  const env = { ...process.env, PORT: port, API_AUDIENCE: audience };
  servers.push(spawn(process.execPath, ['server.ts'], { env, stdio: 'inherit' }));
  await waitFor(`http://localhost:${port}/`);
  return `http://localhost:${port}`;
}

function basic(id: string, secret: string): string {
  return `Basic ${Buffer.from(`${encodeURIComponent(id)}:${encodeURIComponent(secret)}`).toString('base64')}`;
}

async function tokenFor(body: URLSearchParams, id: string, secret: string): Promise<unknown> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { authorization: basic(id, secret) },
    body,
  });
  assert.equal(response.status, 200);
  return response.json();
}

function field(value: unknown, name: string): string {
  assert.ok(typeof value === 'object' && value !== null);
  const found: unknown = (value as Record<string, unknown>)[name];
  assert.equal(typeof found, 'string');
  return found as string;
}

// The same steps a browser takes, so the test can hold a person's tokens.
async function signInAsBen(): Promise<unknown> {
  const verifier = 'v'.repeat(64);
  const challenge = (await import('node:crypto'))
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  const redirect = 'http://localhost:8081/callback';
  const authorize = new URL(`${ISSUER}/protocol/openid-connect/auth`);
  authorize.search = new URLSearchParams({
    response_type: 'code',
    client_id: 'example-web',
    redirect_uri: redirect,
    scope: 'openid',
    state: 's',
    nonce: 'n',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  const page = await fetch(authorize);
  const cookie = page.headers
    .getSetCookie()
    .map((entry) => entry.split(';')[0] ?? '')
    .join('; ');
  const session = /name="auth_session_id" value="([^"]*)"/u.exec(await page.text())?.[1] ?? '';
  const login = await fetch(`${ISSUER}/login-actions/authenticate`, {
    method: 'POST',
    redirect: 'manual',
    headers: { cookie },
    body: new URLSearchParams({
      auth_session_id: session,
      username: 'ben',
      password: 'a long and unremarkable passphrase',
    }),
  });
  const code = new URL(login.headers.get('location') ?? '').searchParams.get('code') ?? '';
  return tokenFor(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirect,
      code_verifier: verifier,
    }),
    'example-web',
    'example-web-secret',
  );
}

let api = '';
let otherAudience = '';
let serviceToken = '';
let unscopedToken = '';
let persons: unknown;

before(async () => {
  api = await start('8082', ISSUER);
  otherAudience = await start('8083', 'https://another-api.example');
  const grant = (scope?: string) =>
    new URLSearchParams({ grant_type: 'client_credentials', ...(scope && { scope }) });
  const service = async (scope?: string) =>
    field(await tokenFor(grant(scope), 'example-m2m', 'example-m2m-secret'), 'access_token');
  persons = await signInAsBen();
  serviceToken = await service('reports:read');
  unscopedToken = await service();
});

after(() => {
  for (const server of servers) server.kill();
});

const get = (base: string, token?: string) =>
  fetch(
    `${base}/reports`,
    token === undefined ? {} : { headers: { authorization: `Bearer ${token}` } },
  );

test('answers a service holding an access token', async () => {
  const response = await get(api, serviceToken);
  assert.equal(response.status, 200);
  assert.equal(field(await response.json(), 'caller'), 'example-m2m');
});

test('refuses a service whose token has no scope, with 403 and not 401', async () => {
  const response = await get(api, unscopedToken);
  assert.equal(response.status, 403);
  assert.match(response.headers.get('www-authenticate') ?? '', /insufficient_scope/u);
});

test('refuses a person whose access token has no scope for this API', async () => {
  const tokens = persons;
  assert.equal((await get(api, field(tokens, 'access_token'))).status, 403);
});

test('refuses a call with no token', async () => {
  assert.equal((await get(api)).status, 401);
});

test('refuses a token issued for another audience', async () => {
  assert.equal((await get(otherAudience, serviceToken)).status, 401);
});

test('refuses an ID token', async () => {
  const tokens = persons;
  assert.equal((await get(api, field(tokens, 'id_token'))).status, 401);
});
