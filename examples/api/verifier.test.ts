// The checks an API runs on a token, against keys and tokens made here, so every
// way a token can be wrong is covered. No stack is needed.
import assert from 'node:assert/strict';
import { type Server, createServer } from 'node:http';
import { test } from 'node:test';
import {
  type CryptoKey,
  type JWK,
  SignJWT,
  base64url,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
} from 'jose';
import { hasScope, makeVerifier, remoteKeys } from './server.ts';

const ISSUER = 'https://id.example.test/tenants/demo';
const API = 'https://api.example.test';
const now = () => Math.floor(Date.now() / 1000);

interface Signer {
  kid: string;
  alg: string;
  privateKey: CryptoKey;
  jwk: JWK;
}

async function signer(alg: string, kid: string): Promise<Signer> {
  const { publicKey, privateKey } = await generateKeyPair(alg, { extractable: true });
  return { kid, alg, privateKey, jwk: { ...(await exportJWK(publicKey)), kid, alg, use: 'sig' } };
}

interface Claims {
  iss?: string;
  aud?: string;
  typ?: string;
  exp?: number;
}

function token(key: Signer, claims: Claims = {}, secret?: Uint8Array): Promise<string> {
  const jwt = new SignJWT({ client_id: 'someone', scope: 'reports:read' })
    .setProtectedHeader({
      alg: secret ? 'HS256' : key.alg,
      kid: key.kid,
      typ: claims.typ ?? 'at+jwt',
    })
    .setIssuer(claims.iss ?? ISSUER)
    .setAudience(claims.aud ?? API)
    .setSubject('someone')
    .setIssuedAt(now() - 600)
    .setExpirationTime(claims.exp ?? now() + 300);
  return jwt.sign(secret ?? key.privateKey);
}

const verifierFor = (...keys: Signer[]) =>
  makeVerifier(createLocalJWKSet({ keys: keys.map((key) => key.jwk) }), ISSUER, API);

test('accepts a token that passes every check', async () => {
  const rsa = await signer('RS256', 'rsa');
  const { payload } = await verifierFor(rsa)(await token(rsa));
  assert.equal(payload.sub, 'someone');
});

test('refuses a token from another issuer', async () => {
  const rsa = await signer('RS256', 'rsa');
  await assert.rejects(
    verifierFor(rsa)(await token(rsa, { iss: 'https://evil.example.test' })),
    /iss/u,
  );
});

test('refuses a token for another audience', async () => {
  const rsa = await signer('RS256', 'rsa');
  await assert.rejects(
    verifierFor(rsa)(await token(rsa, { aud: 'https://other.example.test' })),
    /aud/u,
  );
});

test('refuses an ID token, which is signed by the same keys but is not an access token', async () => {
  const rsa = await signer('RS256', 'rsa');
  await assert.rejects(verifierFor(rsa)(await token(rsa, { typ: 'JWT' })), /typ/u);
});

test('refuses an expired token, and accepts it just before it expires', async () => {
  const rsa = await signer('RS256', 'rsa');
  const verify = verifierFor(rsa);
  await assert.doesNotReject(verify(await token(rsa, { exp: now() + 5 })));
  await assert.rejects(verify(await token(rsa, { exp: now() - 60 })), /exp/u);
});

test('refuses a token signed by a key the tenant never published, under a published kid', async () => {
  const published = await signer('RS256', 'rsa');
  const impostor = await signer('RS256', 'rsa');
  await assert.rejects(verifierFor(published)(await token(impostor)), /signature/u);
});

test('refuses a token that names no key the tenant publishes', async () => {
  const published = await signer('RS256', 'rsa');
  const stranger = await signer('RS256', 'stranger');
  await assert.rejects(verifierFor(published)(await token(stranger)), /applicable key/u);
});

test('refuses an unsigned token', async () => {
  const rsa = await signer('RS256', 'rsa');
  const part = (value: object) => base64url.encode(JSON.stringify(value));
  const claims = { iss: ISSUER, aud: API, sub: 'x', exp: now() + 300 };
  const unsigned = `${part({ alg: 'none', typ: 'at+jwt', kid: 'rsa' })}.${part(claims)}.`;
  await assert.rejects(verifierFor(rsa)(unsigned));
});

test('refuses a token signed with HMAC, keyed by the public key', async () => {
  const rsa = await signer('RS256', 'rsa');
  const secret = new TextEncoder().encode(JSON.stringify(rsa.jwk));
  await assert.rejects(verifierFor(rsa)(await token(rsa, {}, secret)));
});

test('refuses an algorithm the API did not choose, even from a published key', async () => {
  const rsa = await signer('RS256', 'rsa');
  const ec = await signer('ES256', 'ec');
  const verify = verifierFor(rsa, ec);
  await assert.rejects(verify(await token(ec)), /alg/u);
});

test('reads the keys again when the tenant rotates them', async () => {
  const first = await signer('RS256', 'first');
  const second = await signer('RS256', 'second');
  let published = [first.jwk];
  const server: Server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ keys: published }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.ok(address !== null && typeof address === 'object');
    const issuer = `http://127.0.0.1:${String(address.port)}`;
    const verify = makeVerifier(remoteKeys(issuer, { cooldownDuration: 0 }), ISSUER, API);
    // The local address serves the keys only; the tokens still name the tenant.
    await assert.doesNotReject(verify(await token(first)));
    await assert.rejects(verify(await token(second)), /applicable key/u);
    published = [first.jwk, second.jwk];
    await assert.doesNotReject(verify(await token(second)));
  } finally {
    server.close();
  }
});

test('checks a scope the way the API asks for it', () => {
  assert.equal(hasScope({ scope: 'openid reports:read' }, 'reports:read'), true);
  assert.equal(hasScope({ scope: 'reports:readonly' }, 'reports:read'), false);
  assert.equal(hasScope({ scope: '' }, 'reports:read'), false);
  assert.equal(hasScope({}, 'reports:read'), false);
});
