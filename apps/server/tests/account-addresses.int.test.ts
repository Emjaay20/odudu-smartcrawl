import {
  createDatabase,
  MIGRATIONS_DIR,
  runMigrations,
  tenants,
  withTenant,
  type DatabaseHandle,
} from '@odudu/db';
import { lockEmailForCreation, users } from '@odudu/domain-identity';
import { capturingSender, emailOutbox, sendPending, type EmailSender } from '@odudu/email';
import { loadConfig, newId } from '@odudu/kernel';
import { composeUserSubject } from '@odudu/protocol-admin';
import { createAppRole, startTestDatabase, type TestDatabase } from '@odudu/testkit';
import { eq } from 'drizzle-orm';
import { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '#/app';
import { seed } from '#/cli/seed';
import { createLogger } from '#/logger';

// An address is one address whatever its case: reset finds the account
// registration would refuse a second one for, and two registrations for one
// address in two cases cannot both succeed.

let containerHandle: TestDatabase | undefined;
let ownerHandle: DatabaseHandle | undefined;
let appHandle: DatabaseHandle | undefined;
let owner: DatabaseHandle;
let appDb: DatabaseHandle;

const KEK = Buffer.alloc(32, 7);
const PUBLIC_BASE_URL = 'https://idp.example.test';
const FORM = { 'content-type': 'application/x-www-form-urlencoded' };
const PASSWORD = 'correct horse battery staple';

beforeAll(async () => {
  containerHandle = await startTestDatabase();
  ownerHandle = createDatabase(containerHandle.adminUrl);
  owner = ownerHandle;
  await runMigrations(owner.db, MIGRATIONS_DIR);
  const appUrl = await createAppRole(containerHandle.adminUrl);
  appHandle = createDatabase(appUrl, { max: 8 });
  appDb = appHandle;
  process.env.ODUDU_DATABASE_URL = containerHandle.adminUrl;
  process.env.ODUDU_APP_DATABASE_URL = appUrl;
  process.env.ODUDU_KEK = KEK.toString('base64');
  process.env.ODUDU_PUBLIC_BASE_URL = PUBLIC_BASE_URL;
}, 120_000);

afterAll(async () => {
  delete process.env.ODUDU_DATABASE_URL;
  delete process.env.ODUDU_APP_DATABASE_URL;
  delete process.env.ODUDU_KEK;
  delete process.env.ODUDU_PUBLIC_BASE_URL;
  await appHandle?.close();
  await ownerHandle?.close();
  await containerHandle?.stop();
});

beforeEach(async () => {
  await owner.db.delete(emailOutbox);
});

function buildTestApp(): FastifyInstance {
  const config = loadConfig({ ...process.env, ODUDU_LOG_LEVEL: 'silent' });
  return buildApp({
    tls: false,
    database: appDb,
    ownerDatabase: owner,
    kek: KEK,
    logger: createLogger(config),
    publicBaseUrl: PUBLIC_BASE_URL,
  });
}

async function drain(into: EmailSender): Promise<void> {
  await sendPending(
    { database: appDb, ownerDatabase: owner, resolveSender: () => Promise.resolve(into) },
    new Date(),
    { batchSize: 50, maxAttempts: 3, retryBackoffSeconds: 60 },
  );
}

async function tenantWith(settings: {
  email?: string;
  registrationAllowed?: boolean;
}): Promise<{ tenant: string; tenantId: string }> {
  const tenant = `addr-${newId()}`;
  const seeded = await seed({
    tenant,
    clientId: 'addr-spa',
    redirectUris: ['https://app.example/callback'],
    ...(settings.email === undefined
      ? {}
      : { username: 'ada', password: PASSWORD, email: settings.email }),
  });
  await owner.db
    .update(tenants)
    .set({
      resetPasswordAllowed: true,
      registrationAllowed: settings.registrationAllowed ?? false,
    })
    .where(eq(tenants.id, seeded.tenantId));
  return { tenant, tenantId: seeded.tenantId };
}

function requestReset(app: FastifyInstance, tenant: string, email: string) {
  return app.inject({
    method: 'POST',
    url: `/tenants/${tenant}/login-actions/reset-password`,
    payload: new URLSearchParams({ email }).toString(),
    headers: FORM,
  });
}

describe('password reset', () => {
  it.each([
    ['Ada@Example.test', 'ada@example.test'],
    ['ada@example.test', 'ADA@example.TEST'],
  ])(
    'finds the account stored as %s when asked for %s, and mails the stored address',
    async (stored, asked) => {
      const { tenant } = await tenantWith({ email: stored });
      const app = buildTestApp();
      await app.ready();
      try {
        expect((await requestReset(app, tenant, asked)).statusCode).toBe(200);
        const sender = capturingSender();
        await drain(sender);
        expect(sender.sent.map((message) => message.to)).toEqual([stored]);
      } finally {
        await app.close();
      }
    },
  );
});

describe('two registrations for one address in two cases', () => {
  it('lets the second find what the first committed', async () => {
    const { tenant, tenantId } = await tenantWith({ registrationAllowed: true });
    const app = buildTestApp();
    await app.ready();
    try {
      let release: () => void = () => undefined;
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      let locked: () => void = () => undefined;
      const hasLock = new Promise<void>((resolve) => {
        locked = resolve;
      });
      const first = withTenant(appDb.db, tenantId, async (tx) => {
        await lockEmailForCreation(tx, tenantId, 'ada@example.test');
        locked();
        await released;
        await composeUserSubject(tx, {
          tenantId,
          username: 'first',
          email: 'ada@example.test',
        });
      });
      await hasLock;

      const second = app.inject({
        method: 'POST',
        url: `/tenants/${tenant}/login-actions/registration`,
        payload: new URLSearchParams({
          username: 'second',
          email: 'Ada@Example.test',
          password: PASSWORD,
          password_confirm: PASSWORD,
        }).toString(),
        headers: FORM,
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
      release();
      await first;

      expect((await second).statusCode).toBe(400);
      const held = await owner.db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.tenantId, tenantId));
      expect(held).toEqual([{ username: 'first' }]);
    } finally {
      await app.close();
    }
  });
});

describe('where an account came from', () => {
  it('marks the account its own registration form made, and no other', async () => {
    const { tenant, tenantId } = await tenantWith({
      email: 'seeded@example.test',
      registrationAllowed: true,
    });
    const app = buildTestApp();
    await app.ready();
    try {
      const registered = await app.inject({
        method: 'POST',
        url: `/tenants/${tenant}/login-actions/registration`,
        payload: new URLSearchParams({
          username: 'grace',
          email: 'grace@example.test',
          password: PASSWORD,
          password_confirm: PASSWORD,
        }).toString(),
        headers: FORM,
      });
      expect(registered.statusCode).toBe(201);
      const rows = await owner.db
        .select({ username: users.username, selfRegistered: users.selfRegistered })
        .from(users)
        .where(eq(users.tenantId, tenantId));
      expect(rows.sort((a, b) => a.username.localeCompare(b.username))).toEqual([
        { username: 'ada', selfRegistered: false },
        { username: 'grace', selfRegistered: true },
      ]);
    } finally {
      await app.close();
    }
  });
});
