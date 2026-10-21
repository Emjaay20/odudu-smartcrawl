// A web app with a server: it signs a person in with the authorization code
// grant and PKCE, and keeps who they are in a server-side session. For the
// example, sessions live in memory, never expire and travel over plain http;
// a production app needs HTTPS, `Secure` cookies and a real session store.
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import * as client from 'openid-client';

const BASE = process.env.ODUDU_BASE ?? 'http://localhost:3000';
const ISSUER = `${BASE}/tenants/${process.env.TENANT ?? 'demo'}`;
const PORT = Number(process.env.PORT ?? 8081);
const ORIGIN = `http://localhost:${PORT}`;
const REDIRECT_URI = `${ORIGIN}/callback`;
// A published value for the local example stack; never reuse it anywhere real.
const SECRET = process.env.CLIENT_SECRET ?? 'example-web-secret';

const config = await client.discovery(
  new URL(ISSUER),
  process.env.CLIENT_ID ?? 'example-web',
  undefined,
  client.ClientSecretBasic(SECRET),
  { execute: [client.allowInsecureRequests] },
);

interface Session {
  pending?: { verifier: string; state: string; nonce: string };
  person?: { sub: string; name: string };
}
const sessions = new Map<string, Session>();

createServer((request, response) => {
  const cookie = /(?:^|; )sid=([^;]+)/u.exec(request.headers.cookie ?? '')?.[1] ?? '';
  const session = sessions.get(cookie) ?? {};
  const url = new URL(request.url ?? '/', ORIGIN);
  const send = (status: number, body: string, headers: Record<string, string> = {}) => {
    response.writeHead(status, { 'content-type': 'text/html; charset=utf-8', ...headers });
    response.end(body);
  };
  const redirect = (to: string, headers: Record<string, string> = {}) => {
    response.writeHead(302, { location: to, ...headers });
    response.end();
  };

  if (url.pathname === '/login') {
    const pending = {
      verifier: client.randomPKCECodeVerifier(),
      state: client.randomState(),
      nonce: client.randomNonce(),
    };
    const id = randomBytes(24).toString('base64url');
    sessions.set(id, { pending });
    client.calculatePKCECodeChallenge(pending.verifier).then(
      (challenge) => {
        const target = client.buildAuthorizationUrl(config, {
          redirect_uri: REDIRECT_URI,
          scope: 'openid profile',
          code_challenge: challenge,
          code_challenge_method: 'S256',
          state: pending.state,
          nonce: pending.nonce,
        });
        // A new session id at each login, so a stale one cannot be fixed on a person.
        redirect(target.href, { 'set-cookie': `sid=${id}; HttpOnly; SameSite=Lax; Path=/` });
      },
      () => send(500, '<p>Could not start sign-in.</p>'),
    );
    return;
  }

  if (url.pathname === '/callback') {
    const { pending } = session;
    if (pending === undefined) {
      send(400, '<p>No sign-in is under way.</p>');
      return;
    }
    sessions.delete(cookie);
    // Checks state, the issuer, the code's PKCE proof and the ID token's signature and nonce.
    client
      .authorizationCodeGrant(config, url, {
        pkceCodeVerifier: pending.verifier,
        expectedState: pending.state,
        expectedNonce: pending.nonce,
        idTokenExpected: true,
      })
      .then(
        (tokens) => {
          const claims = tokens.claims();
          const id = randomBytes(24).toString('base64url');
          const name = String(claims?.preferred_username ?? claims?.sub);
          sessions.set(id, { person: { sub: String(claims?.sub), name } });
          redirect('/', { 'set-cookie': `sid=${id}; HttpOnly; SameSite=Lax; Path=/` });
        },
        () => send(400, '<p>Sign-in was refused.</p>'),
      );
    return;
  }

  const { person } = session;
  send(
    200,
    person
      ? `<p>Signed in as ${esc(person.name)} (${esc(person.sub)})</p>`
      : '<p>You are signed out. <a href="/login">Sign in</a></p>',
  );
}).listen(PORT, () => {
  console.log(`web app on ${ORIGIN}, trusting ${ISSUER}`);
});

function esc(text: string): string {
  return text.replace(/[&<>"']/gu, (c) => `&#${String(c.charCodeAt(0))};`);
}
