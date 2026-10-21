// A service that signs in as itself and calls an API. It has no dependencies:
// `fetch` is enough. Keep the secret in your platform's secret store, not in code.
const BASE = process.env.ODUDU_BASE ?? 'http://localhost:3000';
const ISSUER = `${BASE}/tenants/${process.env.TENANT ?? 'demo'}`;
const CLIENT_ID = process.env.CLIENT_ID ?? 'example-m2m';
// A published value for the local example stack; never reuse it anywhere real.
const CLIENT_SECRET = process.env.CLIENT_SECRET ?? 'example-m2m-secret';
const API_URL = process.env.API_URL ?? 'http://localhost:8082';

// client_secret_basic: the id and secret are form-encoded, then base64 (RFC 6749 2.3.1).
const basic = Buffer.from(
  `${encodeURIComponent(CLIENT_ID)}:${encodeURIComponent(CLIENT_SECRET)}`,
).toString('base64');

const grant = await fetch(`${ISSUER}/protocol/openid-connect/token`, {
  method: 'POST',
  headers: { authorization: `Basic ${basic}` },
  body: new URLSearchParams({ grant_type: 'client_credentials' }),
});
if (!grant.ok) {
  console.error(`token request refused: ${await grant.text()}`);
  process.exit(1);
}
const { access_token: token } = (await grant.json()) as { access_token: string };

const reports = await fetch(`${API_URL}/reports`, {
  headers: { authorization: `Bearer ${token}` },
});
console.log(`API answered ${reports.status}: ${await reports.text()}`);
if (!reports.ok) process.exit(1);
