// Calls the running API with the tokens Odudu issues and with tokens it must
// refuse. Needs a stack provisioned by ../_shared/provision.sh.
import assert from 'node:assert/strict';
import { type ChildProcess, spawn } from 'node:child_process';
import { after, before, test } from 'node:test';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { makeVerifier } from './server.ts';

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
async function personsTokens(): Promise<unknown> {
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
      username: 'ada',
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

before(async () => {
  api = await start('8082', ISSUER);
  otherAudience = await start('8083', 'https://another-api.example');
  const grant = new URLSearchParams({ grant_type: 'client_credentials' });
  serviceToken = field(await tokenFor(grant, 'example-m2m', 'example-m2m-secret'), 'access_token');
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

test('answers a person holding an access token', async () => {
  const tokens = await personsTokens();
  const response = await get(api, field(tokens, 'access_token'));
  assert.equal(response.status, 200);
});

test('refuses a call with no token', async () => {
  assert.equal((await get(api)).status, 401);
});

test('refuses a token issued for another audience', async () => {
  assert.equal((await get(otherAudience, serviceToken)).status, 401);
});

test('refuses an ID token', async () => {
  const tokens = await personsTokens();
  assert.equal((await get(api, field(tokens, 'id_token'))).status, 401);
});

test('refuses an expired token', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'local', alg: 'RS256' };
  const verify = makeVerifier(createLocalJWKSet({ keys: [jwk] }), ISSUER, ISSUER);
  const sign = (expiresAt: number) =>
    new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'local', typ: 'at+jwt' })
      .setIssuer(ISSUER)
      .setAudience(ISSUER)
      .setSubject('someone')
      .setIssuedAt(expiresAt - 600)
      .setExpirationTime(expiresAt)
      .sign(privateKey);
  const now = Math.floor(Date.now() / 1000);
  await assert.doesNotReject(async () => verify(await sign(now + 300)));
  await assert.rejects(async () => verify(await sign(now - 60)), /exp/u);
});
