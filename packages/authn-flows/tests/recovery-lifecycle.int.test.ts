import { totpCode, totpCounter } from '@odudu/crypto';
import {
  createDatabase,
  MIGRATIONS_DIR,
  tenants,
  runMigrations,
  withTenant,
  type DatabaseHandle,
} from '@odudu/db';
import {
  credentialRepository,
  hashPassword,
  subjectRepository,
  userCredentials,
  users,
} from '@odudu/domain-identity';
import { FakeClock, newId } from '@odudu/kernel';
import { createAppRole, startTestDatabase, type TestDatabase } from '@odudu/testkit';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { requiredActionRepository } from '#/repository/required-actions';
import { type PendingRequest } from '#/schema/authentication-sessions';
import { advance, startAuthentication } from '#/usecase/executor';
import { provisionBrowserFlow } from '#/usecase/provision-flow';
import { beginRecoveryCodes, completeRecoveryCodes } from '#/usecase/recovery-codes';
import { onSecondFactorRemoved } from '#/usecase/second-factor-removed';
import { completeTotpEnrolment } from '#/usecase/totp-enrolment';

const SILENT_LOGGER = { error: (): void => undefined };
const PASSWORD = 'correct horse battery staple';
const TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

let containerHandle: TestDatabase | undefined;
let ownerHandle: DatabaseHandle | undefined;
let appHandle: DatabaseHandle | undefined;
let app: DatabaseHandle;

beforeAll(async () => {
  containerHandle = await startTestDatabase();
  ownerHandle = createDatabase(containerHandle.adminUrl);
  await runMigrations(ownerHandle.db, MIGRATIONS_DIR);
  appHandle = createDatabase(await createAppRole(containerHandle.adminUrl), { max: 5 });
  app = appHandle;
}, 120_000);

afterAll(async () => {
  await appHandle?.close();
  await ownerHandle?.close();
  await containerHandle?.stop();
});

const request: PendingRequest = {
  clientId: 'client-1',
  redirectUri: 'https://client.example/callback',
  scope: 'openid',
  state: null,
  nonce: null,
  codeChallenge: 'challenge-value',
  codeChallengeMethod: 'S256',
};

function clockAt(offsetMs = 0): FakeClock {
  return new FakeClock(new Date(Date.UTC(2032, 0, 1) + offsetMs));
}

interface Account {
  tenantId: string;
  subjectId: string;
}

async function seedAccount(factors: { totp: boolean; passkey: boolean }): Promise<Account> {
  const tenantId = newId();
  const clock = clockAt();
  const subjectId = await withTenant(app.db, tenantId, async (tx) => {
    await tx.insert(tenants).values({ id: tenantId, name: `tenant-${tenantId}` });
    await provisionBrowserFlow(tx, tenantId);
    const subject = await subjectRepository(tx).create({ tenantId, type: 'user' });
    await tx.insert(users).values({ subjectId: subject.id, tenantId, username: 'ada' });
    await tx.insert(userCredentials).values({
      id: newId(),
      tenantId,
      subjectId: subject.id,
      type: 'password',
      secretData: { hash: await hashPassword(PASSWORD) },
    });
    if (factors.totp) {
      const enrolled = await completeTotpEnrolment(
        tx,
        {
          tenantId,
          subjectId: subject.id,
          secret: TOTP_SECRET,
          code: totpCode(TOTP_SECRET, totpCounter(clock.now())),
          authSessionId: newId(),
        },
        clock,
      );
      expect(enrolled).toEqual({ kind: 'enrolled' });
    }
    if (factors.passkey) {
      await credentialRepository(tx).insert({
        tenantId,
        subjectId: subject.id,
        type: 'webauthn',
        secret: { kind: 'webauthn', publicKey: 'AAAA', counter: 0, transports: [] },
        lookupKey: `key-${newId()}`,
      });
    }
    return subject.id;
  });
  return { tenantId, subjectId };
}

function issueCodes(account: Account): Promise<readonly string[]> {
  return withTenant(app.db, account.tenantId, async (tx) => {
    const offer = await beginRecoveryCodes(tx, account);
    await requiredActionRepository(tx).complete(account.subjectId, 'generate-recovery-codes');
    return offer.codes;
  });
}

function acknowledged(account: Account): Promise<void> {
  return withTenant(app.db, account.tenantId, (tx) =>
    requiredActionRepository(tx).complete(account.subjectId, 'generate-recovery-codes'),
  );
}

function standing(account: Account, asTenant = account.tenantId) {
  return withTenant(app.db, asTenant, (tx) =>
    credentialRepository(tx).recoveryStanding(account.subjectId),
  );
}

function pending(account: Account): Promise<string[]> {
  return withTenant(app.db, account.tenantId, (tx) =>
    requiredActionRepository(tx).pendingFor(account.subjectId),
  );
}

function credentialIds(account: Account, type: 'totp' | 'webauthn'): Promise<string[]> {
  return withTenant(app.db, account.tenantId, async (tx) =>
    (await credentialRepository(tx).listFor(account.subjectId, type)).map((row) => row.id),
  );
}

async function removeAndNotify(account: Account, type: 'totp' | 'webauthn') {
  const recorded: unknown[] = [];
  const outcome = await withTenant(app.db, account.tenantId, async (tx) => {
    for (const id of await credentialIds(account, type)) {
      await credentialRepository(tx).deleteOne(id);
    }
    return onSecondFactorRemoved(tx, { subjectId: account.subjectId }, (detail) => {
      recorded.push(detail);
      return Promise.resolve();
    });
  });
  return { outcome, recorded };
}

describe('onSecondFactorRemoved', () => {
  it('deletes the whole set, spent rows too, when the last factor goes, and says so', async () => {
    const account = await seedAccount({ totp: true, passkey: false });
    await issueCodes(account);
    await withTenant(app.db, account.tenantId, async (tx) => {
      const [first] = await credentialRepository(tx).listFor(account.subjectId, 'recovery-code');
      expect(await credentialRepository(tx).spendRecoveryCode(first?.id ?? '', new Date())).toBe(
        true,
      );
    });

    const { outcome, recorded } = await removeAndNotify(account, 'totp');

    expect(outcome).toEqual({ recoveryCodesRevoked: 10 });
    expect(recorded).toEqual([{ revoked: 10, reason: 'last_factor_removed' }]);
    expect(await standing(account)).toEqual({ unspent: 0, held: 0, hasSecondFactor: false });
  });

  it('keeps the set while a passkey remains, and while a TOTP remains', async () => {
    const both = await seedAccount({ totp: true, passkey: true });
    await issueCodes(both);
    const first = await removeAndNotify(both, 'totp');
    expect(first.outcome).toEqual({ recoveryCodesRevoked: 0 });
    expect(first.recorded).toEqual([]);
    expect(await standing(both)).toMatchObject({ unspent: 10, hasSecondFactor: true });

    const second = await removeAndNotify(both, 'webauthn');
    expect(second.outcome).toEqual({ recoveryCodesRevoked: 10 });

    const other = await seedAccount({ totp: true, passkey: true });
    await issueCodes(other);
    await removeAndNotify(other, 'webauthn');
    expect(await standing(other)).toMatchObject({ unspent: 10, hasSecondFactor: true });
  });

  it('does not count a recovery code as a second factor', async () => {
    const account = await seedAccount({ totp: false, passkey: false });
    await issueCodes(account);
    const { outcome } = await removeAndNotify(account, 'totp');
    expect(outcome).toEqual({ recoveryCodesRevoked: 10 });
  });

  it('writes nothing for a subject that holds no codes', async () => {
    const account = await seedAccount({ totp: true, passkey: false });
    await acknowledged(account);
    const { outcome, recorded } = await removeAndNotify(account, 'totp');
    expect(outcome).toEqual({ recoveryCodesRevoked: 0 });
    expect(recorded).toEqual([]);
  });

  it("deletes nothing under a foreign tenant's context", async () => {
    const account = await seedAccount({ totp: false, passkey: false });
    await issueCodes(account);
    const foreign = newId();

    const outcome = await withTenant(app.db, foreign, (tx) =>
      onSecondFactorRemoved(tx, { subjectId: account.subjectId }, () => Promise.resolve()),
    );

    expect(outcome).toEqual({ recoveryCodesRevoked: 0 });
    expect(await standing(account)).toMatchObject({ unspent: 10 });
    expect(await standing(account, foreign)).toEqual({
      unspent: 0,
      held: 0,
      hasSecondFactor: false,
    });
  });

  it('serialises with itself: two concurrent removals revoke the set once', async () => {
    const account = await seedAccount({ totp: true, passkey: true });
    await issueCodes(account);
    const counts = await Promise.all(
      (['totp', 'webauthn'] as const).map((type) =>
        withTenant(app.db, account.tenantId, async (tx) => {
          // The subject row lock every admin mutation takes before it removes a credential.
          await tx.execute(
            sql`select id from subjects where id = ${account.subjectId} for no key update`,
          );
          for (const id of await credentialIds(account, type)) {
            await credentialRepository(tx).deleteOne(id);
          }
          return onSecondFactorRemoved(tx, { subjectId: account.subjectId }, () =>
            Promise.resolve(),
          );
        }),
      ),
    );
    expect(counts.map((c) => c.recoveryCodesRevoked).sort()).toEqual([0, 10]);
    expect(await standing(account)).toMatchObject({ held: 0 });
  });
});

describe('the sign-in that completes with a second factor and no unspent code', () => {
  async function signIn(account: Account, clock: FakeClock, withTotpCode: boolean) {
    const authSessionId = await withTenant(app.db, account.tenantId, async (tx) => {
      const started = await startAuthentication(tx, account.tenantId, request, clock);
      return started.authSessionId;
    });
    await withTenant(app.db, account.tenantId, (tx) =>
      advance(tx, authSessionId, { username: 'ada', password: PASSWORD }, clock, {
        logger: SILENT_LOGGER,
      }),
    );
    if (!withTotpCode) return;
    const outcome = await withTenant(app.db, account.tenantId, (tx) =>
      advance(tx, authSessionId, { code: totpCode(TOTP_SECRET, totpCounter(clock.now())) }, clock, {
        logger: SILENT_LOGGER,
      }),
    );
    expect(outcome.kind).toBe('success');
  }

  it('owes a set once, and not again after the set is saved', async () => {
    const account = await seedAccount({ totp: true, passkey: false });
    await acknowledged(account);
    expect(await pending(account)).toEqual([]);

    await signIn(account, clockAt(90_000), true);
    expect(await pending(account)).toEqual(['generate-recovery-codes']);

    await withTenant(app.db, account.tenantId, (tx) => beginRecoveryCodes(tx, account));
    await withTenant(app.db, account.tenantId, (tx) => completeRecoveryCodes(tx, account));
    await signIn(account, clockAt(180_000), true);
    expect(await pending(account)).toEqual([]);
  });

  it('owes nothing to a subject who holds an unspent code', async () => {
    const account = await seedAccount({ totp: true, passkey: false });
    await issueCodes(account);
    await signIn(account, clockAt(90_000), true);
    expect(await pending(account)).toEqual([]);
  });

  it('owes nothing to a subject with no second factor', async () => {
    const account = await seedAccount({ totp: false, passkey: false });
    await signIn(account, clockAt(90_000), false);
    expect(await pending(account)).toEqual([]);
  });

  it('owes a set to a subject whose only second factor is a passkey', async () => {
    const account = await seedAccount({ totp: false, passkey: true });
    await acknowledged(account);
    await signIn(account, clockAt(90_000), false);
    expect(await pending(account)).toEqual(['generate-recovery-codes']);
  });

  it('owes a set after the whole set is revoked while a factor remains', async () => {
    const account = await seedAccount({ totp: true, passkey: false });
    await issueCodes(account);
    await withTenant(app.db, account.tenantId, (tx) =>
      credentialRepository(tx).deleteRecoveryCodes(account.subjectId),
    );
    await signIn(account, clockAt(90_000), true);
    expect(await pending(account)).toEqual(['generate-recovery-codes']);
  });
});

describe('re-enrolling after the factor was removed', () => {
  it('issues a fresh set, because the old one went with the factor', async () => {
    const account = await seedAccount({ totp: true, passkey: false });
    const old = await issueCodes(account);
    await removeAndNotify(account, 'totp');

    await withTenant(app.db, account.tenantId, async (tx) => {
      const clock = clockAt(300_000);
      await completeTotpEnrolment(
        tx,
        {
          tenantId: account.tenantId,
          subjectId: account.subjectId,
          secret: TOTP_SECRET,
          code: totpCode(TOTP_SECRET, totpCounter(clock.now())),
          authSessionId: newId(),
        },
        clock,
      );
    });

    expect(await pending(account)).toContain('generate-recovery-codes');
    expect(await standing(account)).toMatchObject({ held: 0 });
    expect(old).toHaveLength(10);
  });
});
