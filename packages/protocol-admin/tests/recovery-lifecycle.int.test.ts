import { requiredActionRepository } from '@odudu/authn-flows';
import { withTenant } from '@odudu/db';
import { auditRepository } from '@odudu/domain-audit';
import {
  credentialRepository,
  hashPassword,
  subjectRepository,
  userRepository,
} from '@odudu/domain-identity';
import { emailOutbox } from '@odudu/email';
import { newId } from '@odudu/kernel';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startAdminFixture, type AdminFixture } from '#/testing/admin-fixture';

let fixtureHandle: AdminFixture | undefined;
let fixture: AdminFixture;
beforeAll(async () => {
  fixtureHandle = await startAdminFixture();
  fixture = fixtureHandle;
}, 180_000);
afterAll(async () => {
  await fixtureHandle?.stop();
});

interface Seeded {
  tenant: { id: string; name: string };
  subjectId: string;
  totpId: string | null;
  passkeyId: string | null;
}

async function seed(options: {
  totp: boolean;
  passkey: boolean;
  codes: number;
  email: string | null;
}): Promise<Seeded> {
  const tenant = await fixture.createTenant(`life-${newId()}`);
  return withTenant(fixture.app.db, tenant.id, async (tx) => {
    const subject = await subjectRepository(tx).create({ tenantId: tenant.id, type: 'user' });
    await userRepository(tx).create({
      subjectId: subject.id,
      tenantId: tenant.id,
      username: `ada-${newId()}`,
      email: options.email,
    });
    const credentials = credentialRepository(tx);
    const base = { tenantId: tenant.id, subjectId: subject.id };
    if (options.totp) {
      await credentials.insert({
        ...base,
        type: 'totp',
        secret: { kind: 'totp', secret: 'GEZDGNBVGY3TQOJQ', digits: 6, lastStep: 0 },
      });
    }
    if (options.passkey) {
      await credentials.insert({
        ...base,
        type: 'webauthn',
        secret: { kind: 'webauthn', publicKey: 'AAAA', counter: 0, transports: [] },
        lookupKey: `key-${newId()}`,
      });
    }
    for (let n = 0; n < options.codes; n += 1) {
      await credentials.insert({
        ...base,
        type: 'recovery-code',
        secret: { kind: 'recovery-code', hash: await hashPassword(`code-${String(n)}`) },
      });
    }
    const [totp] = await credentials.listFor(subject.id, 'totp');
    const [passkey] = await credentials.listFor(subject.id, 'webauthn');
    return {
      tenant,
      subjectId: subject.id,
      totpId: totp?.id ?? null,
      passkeyId: passkey?.id ?? null,
    };
  });
}

async function http(
  seeded: Seeded,
  method: 'DELETE',
  tail: string,
  capabilities: readonly string[] = ['manage-users'],
): Promise<number> {
  const token = await fixture.adminToken(seeded.tenant.name, capabilities);
  const res = await fixture.http.inject({
    method,
    url: `/admin/tenants/${seeded.tenant.name}/subjects/${seeded.subjectId}/${tail}`,
    headers: { authorization: `Bearer ${token}` },
  });
  return res.statusCode;
}

function standing(seeded: Seeded, as = seeded.tenant.id) {
  return withTenant(fixture.app.db, as, (tx) =>
    credentialRepository(tx).recoveryStanding(seeded.subjectId),
  );
}

function audits(seeded: Seeded, action: string) {
  return withTenant(fixture.app.db, seeded.tenant.id, async (tx) =>
    (await auditRepository(tx).list({ action, limit: 20 }))
      .filter((row) => row.resourceId === seeded.subjectId)
      .map((row) => row.detail),
  );
}

function mail(seeded: Seeded) {
  return withTenant(fixture.app.db, seeded.tenant.id, (tx) => tx.select().from(emailOutbox));
}

function owed(seeded: Seeded): Promise<string[]> {
  return withTenant(fixture.app.db, seeded.tenant.id, (tx) =>
    requiredActionRepository(tx).pendingFor(seeded.subjectId),
  );
}

describe('removing a second factor through DELETE …/credentials/{id}', () => {
  it('revokes the whole set with the last factor, audits it, and tells the owner', async () => {
    const s = await seed({ totp: true, passkey: false, codes: 10, email: 'ada@example.test' });

    expect(await http(s, 'DELETE', `credentials/${s.totpId ?? ''}`)).toBe(204);

    expect(await standing(s)).toEqual({ unspent: 0, held: 0, hasSecondFactor: false });
    expect(await audits(s, 'subject.recovery_codes_revoke')).toEqual([
      { revoked: 10, reason: 'last_factor_removed' },
    ]);
    expect(await audits(s, 'subject.credential_delete')).toHaveLength(1);
    const queued = await mail(s);
    expect(queued).toHaveLength(1);
    expect(queued[0]?.toAddress).toBe('ada@example.test');
    expect(queued[0]?.subject).toContain('sign-in method was removed');
    expect(queued[0]?.bodyText).toContain('recovery codes were removed');
    expect(queued[0]?.bodyText).not.toMatch(/https?:|[0-9A-Z]{5}-[0-9A-Z]{5}/u);
  });

  it('keeps the set while another second factor remains, and still tells the owner', async () => {
    const s = await seed({ totp: true, passkey: true, codes: 10, email: 'ada@example.test' });

    expect(await http(s, 'DELETE', `credentials/${s.totpId ?? ''}`)).toBe(204);

    expect(await standing(s)).toMatchObject({ unspent: 10, hasSecondFactor: true });
    expect(await audits(s, 'subject.recovery_codes_revoke')).toEqual([]);
    const queued = await mail(s);
    expect(queued).toHaveLength(1);
    expect(queued[0]?.bodyText).not.toContain('recovery codes');
  });

  it('revokes the set when the passkey was the last factor', async () => {
    const s = await seed({ totp: false, passkey: true, codes: 3, email: null });
    expect(await http(s, 'DELETE', `credentials/${s.passkeyId ?? ''}`)).toBe(204);
    expect(await standing(s)).toMatchObject({ held: 0 });
  });

  it('queues nothing for a subject with no address on file', async () => {
    const s = await seed({ totp: true, passkey: false, codes: 2, email: null });
    expect(await http(s, 'DELETE', `credentials/${s.totpId ?? ''}`)).toBe(204);
    expect(await mail(s)).toEqual([]);
    expect(await standing(s)).toMatchObject({ held: 0 });
  });

  it('leaves another tenant’s set alone when its factor id is named here', async () => {
    const mine = await seed({ totp: false, passkey: false, codes: 0, email: null });
    const theirs = await seed({ totp: true, passkey: false, codes: 4, email: null });

    const token = await fixture.adminToken(mine.tenant.name, ['manage-users']);
    const res = await fixture.http.inject({
      method: 'DELETE',
      url: `/admin/tenants/${mine.tenant.name}/subjects/${theirs.subjectId}/credentials/${theirs.totpId ?? ''}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    expect(await standing(theirs)).toMatchObject({ unspent: 4, hasSecondFactor: true });
    expect(await standing(theirs, mine.tenant.id)).toEqual({
      unspent: 0,
      held: 0,
      hasSecondFactor: false,
    });
  });
});

describe('DELETE …/recovery-codes with a second factor remaining', () => {
  it('owes a new set by default, audits that, and tells the owner', async () => {
    const s = await seed({ totp: true, passkey: false, codes: 10, email: 'ada@example.test' });

    expect(await http(s, 'DELETE', 'recovery-codes')).toBe(204);

    expect(await standing(s)).toMatchObject({ held: 0, hasSecondFactor: true });
    expect(await owed(s)).toEqual(['generate-recovery-codes']);
    expect(await audits(s, 'subject.recovery_codes_revoke')).toEqual([
      { revoked: 10, new_set_required: true },
    ]);
    const queued = await mail(s);
    expect(queued).toHaveLength(1);
    expect(queued[0]?.subject).toContain('recovery codes were revoked');
    expect(queued[0]?.bodyText).toContain('save a new set');
  });

  it('owes nothing when require_new_set is false', async () => {
    const s = await seed({ totp: true, passkey: false, codes: 10, email: 'ada@example.test' });

    expect(await http(s, 'DELETE', 'recovery-codes?require_new_set=false')).toBe(204);

    expect(await owed(s)).toEqual([]);
    expect(await audits(s, 'subject.recovery_codes_revoke')).toEqual([
      { revoked: 10, new_set_required: false },
    ]);
    expect((await mail(s))[0]?.bodyText).not.toContain('new set');
  });

  it('owes nothing to a subject with no second factor, which a set would not serve', async () => {
    const s = await seed({ totp: false, passkey: false, codes: 3, email: null });
    expect(await http(s, 'DELETE', 'recovery-codes')).toBe(204);
    expect(await owed(s)).toEqual([]);
    expect(await audits(s, 'subject.recovery_codes_revoke')).toEqual([
      { revoked: 3, new_set_required: false },
    ]);
  });

  it('writes no mail when no code was held', async () => {
    const s = await seed({ totp: true, passkey: false, codes: 0, email: 'ada@example.test' });
    expect(await http(s, 'DELETE', 'recovery-codes')).toBe(204);
    expect(await mail(s)).toEqual([]);
  });

  it('refuses a value that is not true or false', async () => {
    const s = await seed({ totp: true, passkey: false, codes: 2, email: null });
    expect(await http(s, 'DELETE', 'recovery-codes?require_new_set=maybe')).toBe(400);
    expect(await standing(s)).toMatchObject({ held: 2 });
  });
});
