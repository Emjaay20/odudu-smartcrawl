// An API that trusts an access token only after checking it itself. For the
// example the API listens on plain http; a production API sits behind HTTPS.
import { createServer } from 'node:http';
import {
  type JWTPayload,
  type JWTVerifyGetKey,
  type RemoteJWKSetOptions,
  createRemoteJWKSet,
  jwtVerify,
} from 'jose';

const BASE = process.env.ODUDU_BASE ?? 'http://localhost:3000';
const ISSUER = `${BASE}/tenants/${process.env.TENANT ?? 'demo'}`;
// Odudu names the tenant itself as the audience unless a client says otherwise.
// RFC 9068 wants it to name this API: register the audience on the client and
// set API_AUDIENCE to it.
const AUDIENCE = process.env.API_AUDIENCE ?? ISSUER;
const REQUIRED_SCOPE = 'reports:read';

// Fetched on first use, kept, and fetched again when a token names an unknown `kid`.
export function remoteKeys(issuer: string, options?: RemoteJWKSetOptions): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`), options);
}

// The checks, in the order the guide lists them. `typ` is what keeps an ID
// token out: it is signed by the same keys but is not an access token.
export function makeVerifier(keys: JWTVerifyGetKey, issuer: string, audience: string) {
  return (token: string) =>
    jwtVerify(token, keys, { issuer, audience, typ: 'at+jwt', algorithms: ['RS256'] });
}

export function hasScope(payload: JWTPayload, scope: string): boolean {
  return typeof payload.scope === 'string' && payload.scope.split(' ').includes(scope);
}

if (import.meta.main) {
  const verify = makeVerifier(remoteKeys(ISSUER), ISSUER, AUDIENCE);

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
        if (!hasScope(payload, REQUIRED_SCOPE)) {
          const challenge = `Bearer error="insufficient_scope", scope="${REQUIRED_SCOPE}"`;
          return send(403, { error: 'insufficient_scope' }, { 'www-authenticate': challenge });
        }
        const caller = typeof payload.client_id === 'string' ? payload.client_id : payload.sub;
        send(200, { caller, reports: ['q1', 'q2'] });
      },
      () => {
        const challenge = 'Bearer error="invalid_token"';
        send(401, { error: 'invalid_token' }, { 'www-authenticate': challenge });
      },
    );
  }).listen(Number(process.env.PORT ?? 8082), () => {
    console.log(`API on port ${process.env.PORT ?? 8082}, trusting ${ISSUER}`);
  });
}
