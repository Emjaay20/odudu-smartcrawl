import {
  createDatabase,
  MIGRATIONS_DIR,
  runMigrations,
  tenants,
  withTenant,
  type DatabaseHandle,
  type TenantScopedDatabase,
} from '@odudu/db';
import { BidiControlError, newId } from '@odudu/kernel';
import { createAppRole, startTestDatabase, type TestDatabase } from '@odudu/testkit';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { subjectRepository } from '#/repository/subjects';
import { userRepository } from '#/repository/users';
import { users } from '#/schema/users';

const RLO = '\u202E';
const ISOLATE = '\u2066';

let containerHandle: TestDatabase | undefined;
let ownerHandle: DatabaseHandle | undefined;
let appHandle: DatabaseHandle | undefined;

let owner: DatabaseHandle;
let app: DatabaseHandle;

beforeAll(async () => {
  containerHandle = await startTestDatabase();
  ownerHandle = createDatabase(containerHandle.adminUrl);
  owner = ownerHandle;
  await runMigrations(owner.db, MIGRATIONS_DIR);
  appHandle = createDatabase(await createAppRole(containerHandle.adminUrl), { max: 5 });
  app = appHandle;
}, 120_000);

afterAll(async () => {
  await appHandle?.close();
  await ownerHandle?.close();
  await containerHandle?.stop();
});

async function tenant(): Promise<string> {
  const tenantId = newId();
  await owner.db.insert(tenants).values({ id: tenantId, name: `bidi-${tenantId.slice(-12)}` });
  return tenantId;
}

async function createUser(
  tx: TenantScopedDatabase,
  tenantId: string,
  username: string,
): Promise<string> {
  const subject = await subjectRepository(tx).create({ tenantId, type: 'user' });
  await userRepository(tx).create({ subjectId: subject.id, tenantId, username });
  return subject.id;
}

describe('a bidirectional control in an identity or name field', () => {
  it.each([RLO, ISOLATE])(
    'is refused in a new username, and no row is written',
    async (control) => {
      const tenantId = await tenant();
      await expect(
        withTenant(app.db, tenantId, (tx) => createUser(tx, tenantId, `ada${control}`)),
      ).rejects.toBeInstanceOf(BidiControlError);
      const rows = await withTenant(app.db, tenantId, (tx) => tx.select().from(users));
      expect(rows).toHaveLength(0);
    },
  );

  it('is refused in a rename, leaving the username as it was', async () => {
    const tenantId = await tenant();
    const subjectId = await withTenant(app.db, tenantId, (tx) => createUser(tx, tenantId, 'ada'));
    await expect(
      withTenant(app.db, tenantId, (tx) =>
        userRepository(tx).updateUsername(subjectId, `a${RLO}b`),
      ),
    ).rejects.toMatchObject({ code: 'bidi_control_refused', field: 'username' });
    const [row] = await withTenant(app.db, tenantId, (tx) =>
      tx.select().from(users).where(eq(users.subjectId, subjectId)),
    );
    expect(row?.username).toBe('ada');
  });

  it.each([
    ['name', 'name'],
    ['givenName', 'given_name'],
    ['familyName', 'family_name'],
    ['middleName', 'middle_name'],
    ['nickname', 'nickname'],
    ['preferredUsername', 'preferred_username'],
  ] as const)('is refused in %s, naming %s', async (key, field) => {
    const tenantId = await tenant();
    const subjectId = await withTenant(app.db, tenantId, (tx) => createUser(tx, tenantId, 'ada'));
    await expect(
      withTenant(app.db, tenantId, (tx) =>
        userRepository(tx).updateProfile(subjectId, { [key]: `x${RLO}y` }),
      ),
    ).rejects.toMatchObject({ code: 'bidi_control_refused', field });
  });

  it('is tolerated where the patch leaves an existing value as it is, and the row still signs in', async () => {
    const tenantId = await tenant();
    const legacy = `old${RLO}name`;
    const subjectId = await withTenant(app.db, tenantId, (tx) => createUser(tx, tenantId, 'ada'));
    await owner.db
      .update(users)
      .set({ username: legacy, familyName: `fam${RLO}ily` })
      .where(eq(users.subjectId, subjectId));
    const found = await withTenant(app.db, tenantId, (tx) => userRepository(tx).byUsername(legacy));
    expect(found?.user.username).toBe(legacy);
    const updated = await withTenant(app.db, tenantId, (tx) =>
      userRepository(tx).updateProfile(subjectId, { familyName: `fam${RLO}ily`, givenName: 'Ada' }),
    );
    expect(updated.givenName).toBe('Ada');
    expect(updated.familyName).toBe(`fam${RLO}ily`);
  });

  it('is not an obstacle to Arabic and Hebrew names, marks included', async () => {
    const tenantId = await tenant();
    const subjectId = await withTenant(app.db, tenantId, (tx) =>
      createUser(tx, tenantId, 'مستخدم'),
    );
    const updated = await withTenant(app.db, tenantId, (tx) =>
      userRepository(tx).updateProfile(subjectId, {
        givenName: 'שלום',
        familyName: 'س\u200Fل\u200E\u061C',
      }),
    );
    expect(updated.givenName).toBe('שלום');
    const hebrew = await withTenant(app.db, tenantId, (tx) =>
      userRepository(tx).updateUsername(subjectId, 'עברית'),
    );
    expect(hebrew.username).toBe('עברית');
  });

  it('lets a rename leave a stored username as it is, and refuses a changed one', async () => {
    const tenantId = await tenant();
    const subjectId = await withTenant(app.db, tenantId, (tx) => createUser(tx, tenantId, 'ada'));
    const legacy = `old${RLO}name`;
    await owner.db.update(users).set({ username: legacy }).where(eq(users.subjectId, subjectId));
    const same = await withTenant(app.db, tenantId, (tx) =>
      userRepository(tx).updateUsername(subjectId, legacy),
    );
    expect(same.username).toBe(legacy);
    await expect(
      withTenant(app.db, tenantId, (tx) =>
        userRepository(tx).updateUsername(subjectId, `${legacy}!`),
      ),
    ).rejects.toMatchObject({ code: 'bidi_control_refused', field: 'username' });
  });
});
