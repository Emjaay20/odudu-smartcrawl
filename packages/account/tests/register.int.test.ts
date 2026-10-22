import {
  createDatabase,
  MIGRATIONS_DIR,
  tenants,
  runMigrations,
  withTenant,
  type DatabaseHandle,
  type TenantScopedDatabase,
} from '@odudu/db';
import { effectiveRoles, roleRepository } from '@odudu/domain-authz';
import {
  credentialRepository,
  evaluatePassword,
  hashPassword,
  subjectRepository,
  userRepository,
} from '@odudu/domain-identity';
import {
  emailOutbox,
  sendPending,
  type EmailMessage,
  type EmailSender,
  type SendPendingOptions,
} from '@odudu/email';
import { BidiControlError, newId } from '@odudu/kernel';
import { createAppRole, startTestDatabase, type TestDatabase } from '@odudu/testkit';
import formbody from '@fastify/formbody';
import { eq } from 'drizzle-orm';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { tenantSettingsRepository } from '#/repository/tenant-settings';
import { en } from '#/view/messages';
import { actionTokens } from '#/schema/action-tokens';
import { type CreateAccountResult, type NewAccountInput } from '#/usecase/register';
import { registerRegistrationRoute } from '#/view/routes/registration';

// Set by a test that reads the year a mail carries; the system clock otherwise.
let mailNow: Date | null = null;

let containerHandle: TestDatabase | undefined;
let ownerHandle: DatabaseHandle | undefined;
let appHandle: DatabaseHandle | undefined;

let container: TestDatabase;
let owner: DatabaseHandle;
let app: DatabaseHandle;

beforeAll(async () => {
  containerHandle = await startTestDatabase();
  container = containerHandle;

  ownerHandle = createDatabase(container.adminUrl);
  owner = ownerHandle;
  await runMigrations(owner.db, MIGRATIONS_DIR);

  const appUrl = await createAppRole(container.adminUrl);
  appHandle = createDatabase(appUrl, { max: 5 });
  app = appHandle;
}, 120_000);

afterAll(async () => {
  await appHandle?.close();
  await ownerHandle?.close();
  await containerHandle?.stop();
});

function fakeSender(): EmailSender & { sent: EmailMessage[] } {
  const sent: EmailMessage[] = [];
  return {
    sent,
    send(message: EmailMessage): Promise<void> {
      sent.push(message);
      return Promise.resolve();
    },
  };
}

// The real domain-identity and domain-authz wiring, exercised here the way
// apps/server/src/app.ts wires it for real: @odudu/account itself never
// imports either package (packages/account/src/usecase/register.ts explains
// why), so createAccount is a composition-root concern this test performs
// on its behalf.
async function createAccount(
  tx: TenantScopedDatabase,
  tenantId: string,
  input: NewAccountInput,
): Promise<CreateAccountResult> {
  const subject = await subjectRepository(tx).create({ tenantId, type: 'user' });
  await userRepository(tx).create({
    subjectId: subject.id,
    tenantId,
    username: input.username,
    email: input.email,
  });
  await credentialRepository(tx).insert({
    tenantId,
    subjectId: subject.id,
    type: 'password',
    secret: { kind: 'password', hash: await hashPassword(input.password) },
  });
  const defaults = await roleRepository(tx).defaultsForTenant();
  for (const role of defaults) {
    await roleRepository(tx).assignToSubject(subject.id, role.id);
  }
  return { subjectId: subject.id };
}

interface SeededTenant {
  tenantId: string;
  tenantName: string;
}

async function seedTenant(
  name: string,
  settings: { registrationAllowed: boolean; verifyEmail?: boolean },
): Promise<SeededTenant> {
  const tenantId = newId();
  await owner.db.insert(tenants).values({
    id: tenantId,
    name,
    registrationAllowed: settings.registrationAllowed,
    verifyEmail: settings.verifyEmail ?? false,
  });
  return { tenantId, tenantName: name };
}

async function createDefaultRole(tenantId: string, name: string): Promise<void> {
  await withTenant(app.db, tenantId, (tx) =>
    roleRepository(tx).create({ tenantId, name, defaultForNewSubjects: true }),
  );
}

async function roleNamesFor(tenantId: string, subjectId: string): Promise<string[]> {
  const roles = await withTenant(app.db, tenantId, (tx) => effectiveRoles(tx, subjectId));
  return roles.map((role) => role.name);
}

async function subjectIdForUsername(tenantId: string, username: string): Promise<string> {
  const found = await withTenant(app.db, tenantId, (tx) => userRepository(tx).byUsername(username));
  if (found === null) throw new Error(`no user named ${username}`);
  return found.subject.id;
}

async function rawSelectAllActionTokens(tenantId: string) {
  return withTenant(app.db, tenantId, (tx) => tx.select().from(actionTokens));
}

async function outboxRows(tenantId: string) {
  return withTenant(app.db, tenantId, (tx) => tx.select().from(emailOutbox));
}

const OUTBOX_OPTIONS: SendPendingOptions = {
  batchSize: 10,
  maxAttempts: 3,
  retryBackoffSeconds: 60,
};

// Registration only queues the mail; the pass that hands it to a transport
// is packages/email/src/usecase/send-pending.ts, and a test that cares
// where the mail ended up runs it here the way the server's schedule runs
// it there.

async function drainOutbox(into: EmailSender = sender): Promise<void> {
  await sendPending(
    { database: app, ownerDatabase: owner, resolveSender: () => Promise.resolve(into) },
    new Date(),
    OUTBOX_OPTIONS,
  );
}

let sender: ReturnType<typeof fakeSender>;
// Defaults to a configured base so most tests exercise the ordinary path;
// the one test for the fail-closed case overrides it to undefined.
let publicBaseUrl: string | undefined;

function buildHttpApp(): FastifyInstance {
  const instance = Fastify();
  instance.register(formbody);
  registerRegistrationRoute(instance, {
    database: app,
    findTenant: (name) => tenantSettingsRepository(owner.db).byName(name),
    publicBaseUrl,
    now: () => mailNow ?? new Date(),
    createAccount,
    evaluatePassword,
    pageLocales: ['en', 'fr'],
  });
  return instance;
}

let httpApp: FastifyInstance;

beforeEach(async () => {
  sender = fakeSender();
  publicBaseUrl = 'https://idp.example.test';
  httpApp = buildHttpApp();
  await httpApp.ready();
});

async function submitRegistration(
  tenantName: string,
  input: NewAccountInput,
  extra: Record<string, string> = {},
): Promise<{ statusCode: number; body: string }> {
  const form = new URLSearchParams({
    username: input.username,
    email: input.email,
    password: input.password,
    ...extra,
  });
  const res = await httpApp.inject({
    method: 'POST',
    url: `/tenants/${tenantName}/login-actions/registration`,
    payload: form.toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
  return { statusCode: res.statusCode, body: res.body };
}

// Every test below reads either what the queue holds or what a drain
// delivered, so each starts with the queue empty rather than with whatever
// an earlier test left in it.
beforeEach(async () => {
  await owner.db.delete(emailOutbox);
});

describe('self-registration', () => {
  it('is not served at all when the tenant has not enabled it', async () => {
    const { tenantName } = await seedTenant(`tenant-${newId()}`, { registrationAllowed: false });

    const res = await httpApp.inject({ url: `/tenants/${tenantName}/login-actions/registration` });

    expect(res.statusCode).toBe(404);
  });

  it('shows the form in the browser language, in the markup and in Content-Language', async () => {
    const { tenantName } = await seedTenant(`tenant-${newId()}`, { registrationAllowed: true });
    const url = `/tenants/${tenantName}/login-actions/registration`;

    const french = await httpApp.inject({ url, headers: { 'accept-language': 'de, fr;q=0.8' } });
    expect(french.body).toContain('<html lang="fr" dir="ltr">');
    expect(french.headers['content-language']).toBe('fr');

    const none = await httpApp.inject({ url });
    expect(none.body).toContain('<html lang="en" dir="ltr">');
    expect(none.headers['content-language']).toBe('en');
  });

  it('follows the light or dark choice in the odudu-theme cookie, and only that', async () => {
    const { tenantName } = await seedTenant(`tenant-${newId()}`, { registrationAllowed: true });
    const url = `/tenants/${tenantName}/login-actions/registration`;

    const dark = await httpApp.inject({ url, headers: { cookie: 'odudu-theme=dark' } });
    expect(dark.body).toContain('<html lang="en" dir="ltr" data-theme="dark">');

    const none = await httpApp.inject({ url });
    expect(none.body).not.toContain('data-theme');

    for (const cookie of [
      'odudu-theme=LIGHT',
      'odudu-theme=x"><script>alert(1)</script>',
      'odudu-theme=light evil',
      `odudu-theme=${'x'.repeat(9000)}`,
    ]) {
      const hostile = await httpApp.inject({ url, headers: { cookie } });
      expect(hostile.statusCode).toBe(200);
      expect(hostile.body).not.toContain('data-theme');
      expect(hostile.body).not.toContain('alert(1)');
    }
  });

  it('rejects a request naming a tenant that does not exist', async () => {
    const res = await httpApp.inject({ url: '/tenants/does-not-exist/login-actions/registration' });
    expect(res.statusCode).toBe(404);
  });

  it('creates a user and applies the tenant default roles', async () => {
    const { tenantId, tenantName } = await seedTenant(`tenant-${newId()}`, {
      registrationAllowed: true,
    });
    await createDefaultRole(tenantId, 'offline_access');

    const res = await submitRegistration(tenantName, {
      username: 'ada',
      email: 'ada@example.test',
      password: 'correct horse battery',
    });

    expect(res.statusCode).toBe(201);
    const subjectId = await subjectIdForUsername(tenantId, 'ada');
    expect(await roleNamesFor(tenantId, subjectId)).toEqual(['offline_access']);
  });

  it('refuses a password that fails the tenant policy, and creates nothing', async () => {
    const { tenantId, tenantName } = await seedTenant(`tenant-${newId()}`, {
      registrationAllowed: true,
    });

    const res = await submitRegistration(tenantName, {
      username: 'ada',
      email: 'ada@example.test',
      password: 'short',
    });

    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('at least');
    const notCreated = await withTenant(app.db, tenantId, (tx) =>
      userRepository(tx).byUsername('ada'),
    );
    expect(notCreated).toBeNull();
  });

  it('words each broken rule from the catalogue by its code, never the domain sentence', async () => {
    const { tenantName } = await seedTenant(`tenant-${newId()}`, { registrationAllowed: true });
    const instance = Fastify();
    instance.register(formbody);
    registerRegistrationRoute(instance, {
      database: app,
      findTenant: (name) => tenantSettingsRepository(owner.db).byName(name),
      publicBaseUrl,
      now: () => mailNow ?? new Date(),
      createAccount,
      evaluatePassword: () => [
        { rule: 'min-length', message: 'DOMAIN-SENTENCE-ONE' },
        { rule: 'require-digit', message: 'DOMAIN-SENTENCE-TWO' },
      ],
    });
    const res = await instance.inject({
      method: 'POST',
      url: `/tenants/${tenantName}/login-actions/registration`,
      payload: new URLSearchParams({
        username: 'ada',
        email: 'ada@example.test',
        password: 'x',
      }).toString(),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    await instance.close();

    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('>Password must be at least 8 characters long.</li>');
    expect(res.body).toContain('>Password must contain a digit.</li>');
    expect(res.body).not.toContain('DOMAIN-SENTENCE');
  });

  it('words a too-long password from the catalogue, with the limit it was refused at', async () => {
    const { tenantName } = await seedTenant(`tenant-${newId()}`, { registrationAllowed: true });

    const res = await submitRegistration(tenantName, {
      username: 'ada',
      email: 'ada@example.test',
      password: 'x'.repeat(300),
    });

    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('>Password must be at most 256 characters long.</li>');
  });

  it('refuses an address another user in the tenant already holds', async () => {
    const { tenantId, tenantName } = await seedTenant(`tenant-${newId()}`, {
      registrationAllowed: true,
    });

    const first = await submitRegistration(tenantName, {
      username: 'ada',
      email: 'ada@example.test',
      password: 'correct horse battery',
    });
    expect(first.statusCode).toBe(201);

    const second = await submitRegistration(tenantName, {
      username: 'grace',
      email: 'ada@example.test',
      password: 'correct horse battery',
    });
    expect(second.statusCode).toBe(400);

    // The refused registration must not have touched the address it
    // collided with — 'ada' still resolves to exactly the account created
    // by the first request, not a row the second one partially wrote.
    const stillAda = await withTenant(app.db, tenantId, (tx) =>
      userRepository(tx).byUsername('ada'),
    );
    expect(stillAda?.user.email).toBe('ada@example.test');
    const grace = await withTenant(app.db, tenantId, (tx) =>
      userRepository(tx).byUsername('grace'),
    );
    expect(grace).toBeNull();
  });

  it('permits the same address in a different tenant', async () => {
    const tenantA = await seedTenant(`tenant-a-${newId()}`, { registrationAllowed: true });
    const tenantB = await seedTenant(`tenant-b-${newId()}`, { registrationAllowed: true });

    const inA = await submitRegistration(tenantA.tenantName, {
      username: 'ada',
      email: 'ada@example.test',
      password: 'correct horse battery',
    });
    expect(inA.statusCode).toBe(201);

    const inB = await submitRegistration(tenantB.tenantName, {
      username: 'ada',
      email: 'ada@example.test',
      password: 'correct horse battery',
    });
    expect(inB.statusCode).toBe(201);

    const userA = await withTenant(app.db, tenantA.tenantId, (tx) =>
      userRepository(tx).byUsername('ada'),
    );
    const userB = await withTenant(app.db, tenantB.tenantId, (tx) =>
      userRepository(tx).byUsername('ada'),
    );
    expect(userA?.user.email).toBe('ada@example.test');
    expect(userB?.user.email).toBe('ada@example.test');
  });

  it('sends a verification email when the tenant requires one, and none when it does not', async () => {
    const withVerify = await seedTenant(`tenant-${newId()}`, {
      registrationAllowed: true,
      verifyEmail: true,
    });
    const withoutVerify = await seedTenant(`tenant-${newId()}`, {
      registrationAllowed: true,
      verifyEmail: false,
    });

    await submitRegistration(withVerify.tenantName, {
      username: 'ada',
      email: 'ada@example.test',
      password: 'correct horse battery',
    });
    // Queued by the request, sent by the pass: nothing left during the
    // request itself, which is what the reset endpoint's timing test
    // (tests/reset-timing.int.test.ts) exists to hold.
    expect(sender.sent).toHaveLength(0);
    await drainOutbox();
    expect(sender.sent).toHaveLength(1);

    await submitRegistration(withoutVerify.tenantName, {
      username: 'grace',
      email: 'grace@example.test',
      password: 'correct horse battery',
    });
    await drainOutbox();
    expect(sender.sent).toHaveLength(1);
  });

  it('refuses a tenant that has been disabled since registration was enabled for it', async () => {
    const { tenantId, tenantName } = await seedTenant(`tenant-${newId()}`, {
      registrationAllowed: true,
    });
    await owner.db.update(tenants).set({ enabled: false }).where(eq(tenants.id, tenantId));

    const res = await httpApp.inject({ url: `/tenants/${tenantName}/login-actions/registration` });
    expect(res.statusCode).toBe(404);
  });

  // The GET tests above prove the form is hidden; an implementation that
  // hid the form but still accepted a submission would pass every one of
  // them, so the submission path needs its own refusals proven directly.
  it('refuses the submission itself, not just the form, when registration is off', async () => {
    const { tenantName } = await seedTenant(`tenant-${newId()}`, { registrationAllowed: false });
    const res = await submitRegistration(tenantName, {
      username: 'ada',
      email: 'ada@example.test',
      password: 'correct horse battery',
    });
    expect(res.statusCode).toBe(404);
  });

  it('refuses the submission for a tenant that does not exist', async () => {
    const res = await submitRegistration('does-not-exist', {
      username: 'ada',
      email: 'ada@example.test',
      password: 'correct horse battery',
    });
    expect(res.statusCode).toBe(404);
  });

  it('refuses the submission once the tenant has been disabled', async () => {
    const { tenantId, tenantName } = await seedTenant(`tenant-${newId()}`, {
      registrationAllowed: true,
    });
    await owner.db.update(tenants).set({ enabled: false }).where(eq(tenants.id, tenantId));

    const res = await submitRegistration(tenantName, {
      username: 'ada',
      email: 'ada@example.test',
      password: 'correct horse battery',
    });
    expect(res.statusCode).toBe(404);
  });

  it('refuses a blank username rather than creating an unnamed account', async () => {
    const { tenantId, tenantName } = await seedTenant(`tenant-${newId()}`, {
      registrationAllowed: true,
    });

    const res = await submitRegistration(tenantName, {
      username: '',
      email: 'ada@example.test',
      password: 'correct horse battery',
    });

    expect(res.statusCode).toBe(400);
    const stillNone = await withTenant(app.db, tenantId, (tx) =>
      userRepository(tx).byUsername('ada'),
    );
    expect(stillNone).toBeNull();
  });

  it('refuses a bidirectional control in a username with its own sentence, and creates nothing', async () => {
    const { tenantId, tenantName } = await seedTenant(`tenant-${newId()}`, {
      registrationAllowed: true,
    });
    const usernames = [0x202e, 0x2066, 0x2069].map((cp) => `ada${String.fromCodePoint(cp)}`);
    for (const username of usernames) {
      const res = await submitRegistration(tenantName, {
        username,
        email: 'ada@example.test',
        password: 'correct horse battery',
      });
      expect(res.statusCode).toBe(400);
      expect(res.body).toContain(en['registration.refusal.invalidUsername']);
    }
    for (const username of usernames) {
      const found = await withTenant(app.db, tenantId, (tx) =>
        userRepository(tx).byUsername(username),
      );
      expect(found).toBeNull();
    }
    expect(await outboxRows(tenantId)).toHaveLength(0);
  });

  it('refuses before the password is evaluated or an account is attempted', async () => {
    const { tenantName } = await seedTenant(`tenant-${newId()}`, { registrationAllowed: true });
    let evaluated = 0;
    let attempted = 0;
    const counting = Fastify();
    counting.register(formbody);
    registerRegistrationRoute(counting, {
      database: app,
      findTenant: (name) => tenantSettingsRepository(owner.db).byName(name),
      publicBaseUrl,
      now: () => mailNow ?? new Date(),
      createAccount: (tx, tenantId, input) => {
        attempted += 1;
        return createAccount(tx, tenantId, input);
      },
      evaluatePassword: (...args) => {
        evaluated += 1;
        return evaluatePassword(...args);
      },
    });
    const res = await counting.inject({
      method: 'POST',
      url: `/tenants/${tenantName}/login-actions/registration`,
      payload: new URLSearchParams({
        username: `ada${String.fromCodePoint(0x202e)}`,
        email: 'ada@example.test',
        password: 'correct horse battery',
      }).toString(),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(res.statusCode).toBe(400);
    expect({ evaluated, attempted }).toEqual({ evaluated: 0, attempted: 0 });
  });

  it('answers the same when the repository is what refuses the control', async () => {
    const { tenantName } = await seedTenant(`tenant-${newId()}`, { registrationAllowed: true });
    const refusing = Fastify();
    refusing.register(formbody);
    registerRegistrationRoute(refusing, {
      database: app,
      findTenant: (name) => tenantSettingsRepository(owner.db).byName(name),
      publicBaseUrl,
      now: () => mailNow ?? new Date(),
      createAccount: () => Promise.reject(new BidiControlError('username')),
      evaluatePassword,
    });
    const res = await refusing.inject({
      method: 'POST',
      url: `/tenants/${tenantName}/login-actions/registration`,
      payload: new URLSearchParams({
        username: 'ada',
        email: 'ada@example.test',
        password: 'correct horse battery',
      }).toString(),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain(en['registration.refusal.invalidUsername']);
  });

  it('registers right-to-left usernames, which then sign in by lookup', async () => {
    const { tenantId, tenantName } = await seedTenant(`tenant-${newId()}`, {
      registrationAllowed: true,
    });
    for (const [username, email] of [
      ['مستخدم', 'ar@example.test'],
      ['עברית', 'he@example.test'],
      [`فارسی${String.fromCodePoint(0x200f)}`, 'fa@example.test'],
    ] as const) {
      const res = await submitRegistration(tenantName, {
        username,
        email,
        password: 'correct horse battery',
      });
      expect(res.statusCode, username).toBe(201);
      expect(await subjectIdForUsername(tenantId, username)).toBeDefined();
    }
  });

  it('refuses a username another user in the tenant already holds, as a 400', async () => {
    const { tenantName } = await seedTenant(`tenant-${newId()}`, { registrationAllowed: true });

    const first = await submitRegistration(tenantName, {
      username: 'ada',
      email: 'ada@example.test',
      password: 'correct horse battery',
    });
    expect(first.statusCode).toBe(201);

    const second = await submitRegistration(tenantName, {
      username: 'ada',
      email: 'grace@example.test',
      password: 'correct horse battery',
    });

    expect(second.statusCode).toBe(400);
  });

  it('refuses a malformed address as a 400, not an unhandled error', async () => {
    const { tenantName } = await seedTenant(`tenant-${newId()}`, { registrationAllowed: true });

    const res = await submitRegistration(tenantName, {
      username: 'ada',
      email: 'not-an-email',
      password: 'correct horse battery',
    });

    expect(res.statusCode).toBe(400);
  });

  it.each([
    ['2026-12-31T23:59:59Z', '2026'],
    ['2027-01-01T00:00:00Z', '2027'],
    ['2031-06-01T12:00:00Z', '2031'],
  ])(
    'stamps the verification mail with the year of the clock it was given: %s',
    async (instant, year) => {
      const { tenantId, tenantName } = await seedTenant(`tenant-${newId()}`, {
        registrationAllowed: true,
        verifyEmail: true,
      });
      mailNow = new Date(instant);
      try {
        const res = await submitRegistration(tenantName, {
          username: 'ada',
          email: 'ada@example.test',
          password: 'correct horse battery',
        });
        expect(res.statusCode).toBe(201);
      } finally {
        mailNow = null;
      }

      const [queued] = await outboxRows(tenantId);
      expect(queued?.bodyHtml).toContain(`\u00a9 ${year} Odudu`);
      expect(queued?.bodyText).toContain(`\u00a9 ${year} Odudu`);
    },
  );

  it('registers the account whatever the transport later does with the mail', async () => {
    const { tenantId, tenantName } = await seedTenant(`tenant-${newId()}`, {
      registrationAllowed: true,
      verifyEmail: true,
    });
    const throwingSender: EmailSender = {
      send: () => Promise.reject(new Error('mail transport unavailable')),
    };

    const res = await submitRegistration(tenantName, {
      username: 'ada',
      email: 'ada@example.test',
      password: 'correct horse battery',
    });

    // The transport is not on this path at all, so its failures cannot
    // reach the caller: the account is created, the token is stored, and
    // the message waits for a pass that can retry it.
    expect(res.statusCode).toBe(201);
    expect(await rawSelectAllActionTokens(tenantId)).toHaveLength(1);

    await drainOutbox(throwingSender);

    const queued = await outboxRows(tenantId);
    expect(queued).toHaveLength(1);
    expect(queued[0]?.sentAt).toBeNull();
    expect(queued[0]?.lastError).toBe('mail transport unavailable');
    const created = await withTenant(app.db, tenantId, (tx) =>
      userRepository(tx).byUsername('ada'),
    );
    expect(created).not.toBeNull();
  });

  it('refuses to register when verify_email is on but no public base url is configured', async () => {
    const { tenantId, tenantName } = await seedTenant(`tenant-${newId()}`, {
      registrationAllowed: true,
      verifyEmail: true,
    });
    publicBaseUrl = undefined;
    httpApp = buildHttpApp();
    await httpApp.ready();

    const res = await submitRegistration(tenantName, {
      username: 'ada',
      email: 'ada@example.test',
      password: 'correct horse battery',
    });

    expect(res.statusCode).toBe(500);
    const notCreated = await withTenant(app.db, tenantId, (tx) =>
      userRepository(tx).byUsername('ada'),
    );
    expect(notCreated).toBeNull();
    expect(await outboxRows(tenantId)).toEqual([]);
  });

  describe('refused in place, with a way back to sign-in', () => {
    const SIGN_IN = (tenant: string): string =>
      `/tenants/${tenant}/protocol/openid-connect/auth?response_type=code&client_id=portal&state=a%20b`;
    const escaped = (value: string): string => value.replaceAll('&', '&amp;');

    async function open(): Promise<SeededTenant> {
      return seedTenant(`tenant-${newId()}`, { registrationAllowed: true });
    }

    it('shows the sign-in link on the form only when a valid way was carried', async () => {
      const { tenantName } = await open();
      const path = SIGN_IN(tenantName);

      const carried = await httpApp.inject({
        url: `/tenants/${tenantName}/login-actions/registration?return_to=${encodeURIComponent(path)}`,
      });
      expect(carried.statusCode).toBe(200);
      expect(carried.body).toContain(`<a href="${escaped(path)}">Back to sign in</a>`);
      expect(carried.body).toContain(`name="return_to" value="${escaped(path)}"`);

      const direct = await httpApp.inject({
        url: `/tenants/${tenantName}/login-actions/registration`,
      });
      expect(direct.body).not.toContain('Back to sign in');
      expect(direct.body).not.toContain('return_to');
    });

    it.each([
      [
        'another tenant',
        (tenant: string) => `/tenants/other-${tenant}/protocol/openid-connect/auth?a=b`,
      ],
      [
        'a foreign address',
        () => 'https://evil.example/tenants/x/protocol/openid-connect/auth?a=b',
      ],
      ['a scheme-relative address', () => '//evil.example/x'],
      ['a script', () => 'javascript:alert(1)'],
    ])('drops a return_to naming %s, from the form and from the refusal', async (_label, build) => {
      const { tenantName } = await open();
      const bad = build(tenantName);

      const form = await httpApp.inject({
        url: `/tenants/${tenantName}/login-actions/registration?return_to=${encodeURIComponent(bad)}`,
      });
      expect(form.body).not.toContain('Back to sign in');
      expect(form.body).not.toContain(escaped(bad));

      const refused = await submitRegistration(
        tenantName,
        { username: 'ada', email: 'ada@example.test', password: '' },
        { return_to: bad },
      );
      expect(refused.statusCode).toBe(400);
      expect(refused.body).not.toContain('Back to sign in');
      expect(refused.body).not.toContain('evil.example');
    });

    it('puts a short password back on the same form with its rules, the way back and the safe values', async () => {
      const { tenantName } = await open();
      const path = SIGN_IN(tenantName);

      const res = await submitRegistration(
        tenantName,
        { username: 'ada', email: 'ada@example.test', password: 'zq9xv' },
        { return_to: path },
      );

      expect(res.statusCode).toBe(400);
      expect(res.body).toContain('<form method="post" action="/tenants/');
      expect(res.body).toContain('role="alert" id="form-error"');
      expect(res.body).toContain('aria-invalid="true" aria-describedby="form-error-0');
      expect(res.body).toContain('value="ada"');
      expect(res.body).toContain('value="ada@example.test"');
      expect(res.body).not.toContain('zq9xv');
      expect(res.body).toContain(`name="return_to" value="${escaped(path)}"`);
      expect(res.body).toContain(`<a href="${escaped(path)}">Back to sign in</a>`);
    });

    it('names each field left empty and keeps the others', async () => {
      const { tenantName } = await open();

      const res = await submitRegistration(tenantName, {
        username: 'ada',
        email: '',
        password: '',
      });

      expect(res.statusCode).toBe(400);
      expect(res.body).toContain('Enter an email address.');
      expect(res.body).toContain('Enter a password.');
      expect(res.body).not.toContain('Enter a username.');
      expect(res.body).toContain('value="ada"');
    });

    it('answers a taken username and a taken address on their own fields, as a 400', async () => {
      const { tenantName } = await open();
      const first = await submitRegistration(tenantName, {
        username: 'ada',
        email: 'ada@example.test',
        password: 'correct horse battery',
      });
      expect(first.statusCode).toBe(201);

      const sameName = await submitRegistration(tenantName, {
        username: 'ada',
        email: 'other@example.test',
        password: 'correct horse battery',
      });
      expect(sameName.statusCode).toBe(400);
      expect(sameName.body).toContain('That username is already taken.');
      expect(sameName.body).toMatch(/name="username"[^>]*aria-invalid="true"/u);

      const sameMail = await submitRegistration(tenantName, {
        username: 'grace',
        email: 'ada@example.test',
        password: 'correct horse battery',
      });
      expect(sameMail.statusCode).toBe(400);
      expect(sameMail.body).toContain('That email address is already registered.');
      expect(sameMail.body).toMatch(/name="email"[^>]*aria-invalid="true"/u);
      expect(sameMail.body).toContain('value="grace"');
    });

    it('does not read another tenant: a taken name in one is free in the other', async () => {
      const a = await open();
      const b = await open();
      await submitRegistration(a.tenantName, {
        username: 'ada',
        email: 'ada@example.test',
        password: 'correct horse battery',
      });

      const inB = await submitRegistration(b.tenantName, {
        username: 'ada',
        email: 'ada@example.test',
        password: 'correct horse battery',
      });

      expect(inB.statusCode).toBe(201);
      expect(inB.body).not.toContain('already');
    });

    it('links the success page onward, and the unavailable page back and to a retry', async () => {
      const { tenantName } = await open();
      const path = SIGN_IN(tenantName);
      const done = await submitRegistration(
        tenantName,
        { username: 'ada', email: 'ada@example.test', password: 'correct horse battery' },
        { return_to: path },
      );
      expect(done.statusCode).toBe(201);
      expect(done.body).toContain(`<a href="${escaped(path)}">Back to sign in</a>`);

      const verifying = await seedTenant(`tenant-${newId()}`, {
        registrationAllowed: true,
        verifyEmail: true,
      });
      publicBaseUrl = undefined;
      httpApp = buildHttpApp();
      await httpApp.ready();
      const unavailable = await submitRegistration(
        verifying.tenantName,
        { username: 'ada', email: 'ada@example.test', password: 'correct horse battery' },
        { return_to: SIGN_IN(verifying.tenantName) },
      );
      expect(unavailable.statusCode).toBe(500);
      expect(unavailable.body).toContain('>Try again</a>');
      expect(unavailable.body).toContain('>Back to sign in</a>');
      expect(unavailable.body).not.toContain('<form');
    });
  });
});
