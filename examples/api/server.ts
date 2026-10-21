// An API that trusts an access token only after checking it itself. For the
// example the API listens on plain http; a production API sits behind HTTPS.
import { createServer } from 'node:http';
import { type JWTVerifyGetKey, createRemoteJWKSet, jwtVerify } from 'jose';

const BASE = process.env.ODUDU_BASE ?? 'http://localhost:3000';
const ISSUER = `${BASE}/tenants/${process.env.TENANT ?? 'demo'}`;
// Odudu names the tenant itself as the audience unless a client says otherwise.
const AUDIENCE = process.env.API_AUDIENCE ?? ISSUER;

// The checks, in the order the guide lists them. `typ` is what keeps an ID
// token out: it is signed by the same keys but is not an access token.
export function makeVerifier(keys: JWTVerifyGetKey, issuer: string, audience: string) {
  return (token: string) =>
    jwtVerify(token, keys, { issuer, audience, typ: 'at+jwt', algorithms: ['RS256'] });
}

if (import.meta.main) {
  // Fetched on first use, cached, and refetched when a token names an unknown `kid`.
  const keys = createRemoteJWKSet(new URL(`${ISSUER}/protocol/openid-connect/certs`));
  const verify = makeVerifier(keys, ISSUER, AUDIENCE);

  createServer((request, response) => {
    const send = (status: number, body: unknown, headers: Record<string, string> = {}) => {
      response.writeHead(status, { 'content-type': 'application/json', ...headers });
      response.end(JSON.stringify(body));
    };
    if (request.url !== '/reports') return send(200, { name: 'example API' });

    const token = /^Bearer (\S+)$/u.exec(request.headers.authorization ?? '')?.[1];
    if (token === undefined) {
      return send(401, { error: 'missing_token' }, { 'www-authenticate': 'Bearer' });
    }
    verify(token).then(
      ({ payload }) => {
        const caller = typeof payload.client_id === 'string' ? payload.client_id : payload.sub;
        send(200, { caller, reports: ['q1', 'q2'] });
      },
      () => {
        send(
          401,
          { error: 'invalid_token' },
          { 'www-authenticate': 'Bearer error="invalid_token"' },
        );
      },
    );
  }).listen(Number(process.env.PORT ?? 8082), () => {
    console.log(`API on port ${process.env.PORT ?? 8082}, trusting ${ISSUER}`);
  });
}
