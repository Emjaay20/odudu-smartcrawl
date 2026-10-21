// A service that signs in as itself and calls an API. It has no dependencies:
// `fetch` is enough. Keep the secret in your platform's secret store, not in code.
const BASE = process.env.ODUDU_BASE ?? 'http://localhost:3000';
const API_URL = process.env.API_URL ?? 'http://localhost:8082';
// Renew this long before the token expires, so a call never carries a token that dies in flight.
const SKEW_MS = 30_000;

interface TokenSourceOptions {
  issuer: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  fetch?: typeof fetch;
  now?: () => number;
}

// Returns a function that gives the token it holds until it is nearly expired,
// then asks again with the credentials the service already has.
export function createTokenSource(options: TokenSourceOptions): () => Promise<string> {
  const { issuer, clientId, clientSecret, scope } = options;
  const send = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  // client_secret_basic: the id and secret are form-encoded, then base64 (RFC 6749 2.3.1).
  const basic = Buffer.from(
    `${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`,
  ).toString('base64');
  let held: { token: string; renewAt: number } | undefined;
  let pending: Promise<string> | undefined;

  async function renew(): Promise<string> {
    const grant = await send(`${issuer}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { authorization: `Basic ${basic}` },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!grant.ok) throw new Error(`token request refused: ${await grant.text()}`);
    const body = (await grant.json()) as { access_token: string; expires_in: number };
    held = { token: body.access_token, renewAt: now() + body.expires_in * 1000 - SKEW_MS };
    return body.access_token;
  }

  return () => {
    if (held !== undefined && now() < held.renewAt) return Promise.resolve(held.token);
    // Calls that arrive while a request is out share it.
    pending ??= renew().finally(() => {
      pending = undefined;
    });
    return pending;
  };
}

if (import.meta.main) {
  const token = createTokenSource({
    issuer: `${BASE}/tenants/${process.env.TENANT ?? 'demo'}`,
    clientId: process.env.CLIENT_ID ?? 'example-m2m',
    // A published value for the local example stack; never reuse it anywhere real.
    clientSecret: process.env.CLIENT_SECRET ?? 'example-m2m-secret',
    scope: 'reports:read',
  });
  try {
    const reports = await fetch(`${API_URL}/reports`, {
      headers: { authorization: `Bearer ${await token()}` },
      signal: AbortSignal.timeout(10_000),
    });
    console.log(`API answered ${reports.status}: ${await reports.text()}`);
    if (!reports.ok) process.exit(1);
  } catch (error) {
    console.error(String(error));
    process.exit(1);
  }
}
