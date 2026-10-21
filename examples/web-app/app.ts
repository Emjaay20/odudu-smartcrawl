// A web app with a server: it signs a person in with the authorization code
// grant and PKCE, keeps who they are in a server-side session, and signs them
// out of Odudu too. For the example, sessions live in memory, never expire and
// travel over plain http, and `allowInsecureRequests` lets the library talk to
// an http issuer; a production app needs HTTPS, `Secure` cookies and a real
// session store, and never allows insecure requests.
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
  person?: { sub: string; name: string; idToken: string };
}
const sessions = new Map<string, Session>();
const cookieFor = (id: string, maxAge = '') => `sid=${id}; HttpOnly; SameSite=Lax; Path=/${maxAge}`;

createServer((request, response) => {
  const cookie = /(?:^|; )sid=([^;]+)/u.exec(request.headers.cookie ?? '')?.[1] ?? '';
  const session = sessions.get(cookie) ?? {};
  const url = new URL(request.url ?? '/', ORIGIN);
  const send = (status: number, body: string) => {
    response.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
    response.end(body);
  };
  const redirect = (to: string, setCookie: string) => {
    response.writeHead(302, { location: to, 'set-cookie': setCookie });
    response.end();
  };
  // A new session id at each step, so a stale one cannot be fixed on a person.
  const begin = (value: Session) => {
    const id = randomBytes(24).toString('base64url');
    sessions.set(id, value);
    return id;
  };

  if (url.pathname === '/login') {
    const pending = {
      verifier: client.randomPKCECodeVerifier(),
      state: client.randomState(),
      nonce: client.randomNonce(),
    };
    const id = begin({ pending });
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
        redirect(target.href, cookieFor(id));
      },
      () => send(500, '<p>Could not start sign-in.</p>'),
    );
  } else if (url.pathname === '/callback') {
    const { pending } = session;
    if (pending === undefined) return send(400, '<p>No sign-in is under way.</p>');
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
          const sub = String(claims?.sub);
          const name = String(claims?.preferred_username ?? sub);
          const idToken = tokens.id_token ?? '';
          redirect('/', cookieFor(begin({ person: { sub, name, idToken } })));
        },
        (error: unknown) => {
          console.error(`sign-in refused: ${why(error)}`);
          send(400, '<p>Sign-in was refused.</p>');
        },
      );
  } else if (url.pathname === '/logout' && request.method === 'POST') {
    sessions.delete(cookie);
    // Ends the person's session at Odudu too, which the id_token_hint names.
    const target = session.person
      ? client.buildEndSessionUrl(config, {
          post_logout_redirect_uri: `${ORIGIN}/`,
          id_token_hint: session.person.idToken,
        }).href
      : '/';
    redirect(target, cookieFor('', '; Max-Age=0'));
  } else {
    const { person } = session;
    send(
      200,
      person
        ? `<p>Signed in as ${esc(person.name)} (${esc(person.sub)})</p>` +
            '<form method="post" action="/logout"><button>Sign out</button></form>'
        : '<p>You are signed out. <a href="/login">Sign in</a></p>',
    );
  }
}).listen(PORT, () => {
  console.log(`web app on ${ORIGIN}, trusting ${ISSUER}`);
});

// The library's own wording for what failed, never the values it compared:
// those hold the code and the state.
function why(error: unknown): string {
  const parts = [String(error)];
  if (error instanceof Error && error.cause instanceof Error) parts.push(error.cause.message);
  if (error instanceof client.ResponseBodyError) parts.push(error.error);
  return parts.join(': ');
}

function esc(text: string): string {
  return text.replace(/[&<>"']/gu, (c) => `&#${String(c.charCodeAt(0))};`);
}
