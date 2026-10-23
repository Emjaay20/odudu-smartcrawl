import { unwrapSecret } from '@odudu/crypto';
import { createDatabase, MIGRATIONS_DIR, runMigrations, type DatabaseHandle } from '@odudu/db';
import { ADMIN_API_AUDIENCE, ADMIN_CLIENT_ID, SYSTEM_TENANT_NAME } from '@odudu/domain-tenant';
import { newId } from '@odudu/kernel';
import { createAppRole, startTestDatabase, type TestDatabase } from '@odudu/testkit';
import { sql } from 'drizzle-orm';
import { type LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedAdmin } from '#/cli/seed';
import { CONSOLE_CLIENT_KEY } from '#/testing/console-key';
import {
  adminAssertion,
  Jar,
  KEK,
  signIn,
  startConsoleApp,
  storedRefreshToken,
  type ConsoleStack,
} from '#/testing/console-harness';

// Every endpoint that checks the issuer or the token endpoint's address checks
// the configured base, so a request that arrives under a forged Host is judged
// exactly as one under the right Host: the admin API's bearer check, userinfo,
// introspection, revocation, and the private_key_jwt audience.

const BASE = 'http://console.example.test';
const FORGED = 'evil.example';
const TOKEN = `/tenants/${SYSTEM_TENANT_NAME}/protocol/openid-connect`;

let container: TestDatabase;
let owner: DatabaseHandle;
let appDb: DatabaseHandle;

beforeAll(async () => {
  container = await startTestDatabase();
  owner = createDatabase(container.adminUrl);
  await runMigrations(owner.db, MIGRATIONS_DIR);
  const appUrl = await createAppRole(container.adminUrl);
  appDb = createDatabase(appUrl, { max: 5 });
  process.env.ODUDU_DATABASE_URL = container.adminUrl;
  process.env.ODUDU_APP_DATABASE_URL = appUrl;
  process.env.ODUDU_KEK = KEK.toString('base64');
  process.env.ODUDU_CONSOLE_CLIENT_KEY = CONSOLE_CLIENT_KEY;
  process.env.ODUDU_PUBLIC_BASE_URL = BASE;
  await seedAdmin({ username: `setup-${newId()}` });
}, 120_000);

afterAll(async () => {
  delete process.env.ODUDU_DATABASE_URL;
  delete process.env.ODUDU_APP_DATABASE_URL;
  delete process.env.ODUDU_KEK;
  delete process.env.ODUDU_CONSOLE_CLIENT_KEY;
  delete process.env.ODUDU_PUBLIC_BASE_URL;
  await appDb.close();
  await owner.close();
  await container.stop();
});

async function accessTokenOf(subjectId: string): Promise<string> {
  const rows = await owner.db.execute<{ access_token_wrapped: string }>(
    sql`SELECT access_token_wrapped FROM console_sessions WHERE subject_id = ${subjectId}`,
  );
  const wrapped = rows[0]?.access_token_wrapped;
  if (wrapped === undefined) throw new Error('no console session');
  return unwrapSecret(wrapped, KEK);
}

function form(
  stack: ConsoleStack,
  host: string,
  url: string,
  fields: Record<string, string>,
): Promise<LightMyRequestResponse> {
  return stack.app.inject({
    method: 'POST',
    url,
    payload: new URLSearchParams(fields).toString(),
    headers: { host, 'content-type': 'application/x-www-form-urlencoded' },
  });
}

describe('a forged Host is judged as the configured one', () => {
  it('for the admin API, userinfo, introspection, the token endpoint audience and revocation', async () => {
    const stack = await startConsoleApp({ database: appDb, ownerDatabase: owner }, BASE);
    try {
      const { subjectId } = await signIn(stack, new Jar());
      const accessToken = await accessTokenOf(subjectId);
      const refreshToken = await storedRefreshToken(owner, subjectId);
      const bearer = { authorization: `Bearer ${accessToken}` };

      for (const host of [stack.base.host, FORGED]) {
        const admin = await stack.app.inject({
          url: `/admin/tenants/${SYSTEM_TENANT_NAME}/whoami`,
          headers: { host, ...bearer },
        });
        expect(admin.statusCode, `admin API at ${host}`).toBe(200);

        const userinfo = await stack.app.inject({
          url: `${TOKEN}/userinfo`,
          headers: { host, ...bearer },
        });
        expect(userinfo.statusCode, `userinfo at ${host}`).not.toBe(401);

        const introspected = await form(stack, host, `${TOKEN}/token/introspect`, {
          token: accessToken,
          ...(await adminAssertion(stack)),
          client_id: ADMIN_CLIENT_ID,
        });
        expect(introspected.statusCode, `introspect at ${host}`).toBe(200);
        expect(introspected.json<{ active: boolean }>().active, `introspect at ${host}`).toBe(true);
      }

      // The audience an assertion must name is the configured token endpoint,
      // not the address the request claims: the refresh below succeeds under a
      // forged Host and rotates the token.
      const refreshed = await form(stack, FORGED, `${TOKEN}/token`, {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: ADMIN_CLIENT_ID,
        resource: ADMIN_API_AUDIENCE,
        ...(await adminAssertion(stack)),
      });
      expect(refreshed.statusCode).toBe(200);
      const next = refreshed.json<{ refresh_token: string }>().refresh_token;

      const revoked = await form(stack, FORGED, `${TOKEN}/revoke`, {
        token: next,
        token_type_hint: 'refresh_token',
        client_id: ADMIN_CLIENT_ID,
        ...(await adminAssertion(stack)),
      });
      expect(revoked.statusCode).toBe(200);
      const replay = await form(stack, stack.base.host, `${TOKEN}/token`, {
        grant_type: 'refresh_token',
        refresh_token: next,
        client_id: ADMIN_CLIENT_ID,
        resource: ADMIN_API_AUDIENCE,
        ...(await adminAssertion(stack)),
      });
      expect(replay.statusCode).toBe(400);
    } finally {
      await stack.app.close();
    }
  });
});
