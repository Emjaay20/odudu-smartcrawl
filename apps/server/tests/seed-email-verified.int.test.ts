import { createDatabase, MIGRATIONS_DIR, runMigrations, type DatabaseHandle } from '@odudu/db';
import { users } from '@odudu/domain-identity';
import { newId } from '@odudu/kernel';
import { createAppRole, startTestDatabase, type TestDatabase } from '@odudu/testkit';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seed } from '#/cli/seed';

// `seed user` and `seed profile` can record an address as verified, as
// `seed profile` already could a phone number, so a script need not reach for
// SQL or the console.

const PASSWORD = 'correct horse battery staple';

let container: TestDatabase;
let owner: DatabaseHandle;

beforeAll(async () => {
  container = await startTestDatabase();
  owner = createDatabase(container.adminUrl);
  await runMigrations(owner.db, MIGRATIONS_DIR);
  const appUrl = await createAppRole(container.adminUrl);
  process.env.ODUDU_DATABASE_URL = container.adminUrl;
  process.env.ODUDU_APP_DATABASE_URL = appUrl;
  process.env.ODUDU_KEK = Buffer.alloc(32, 7).toString('base64');
}, 120_000);

afterAll(async () => {
  delete process.env.ODUDU_DATABASE_URL;
  delete process.env.ODUDU_APP_DATABASE_URL;
  delete process.env.ODUDU_KEK;
  await owner.close();
  await container.stop();
});

async function verified(tenantId: string, username: string): Promise<boolean | undefined> {
  const [row] = await owner.db
    .select({ emailVerified: users.emailVerified })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.username, username)));
  return row?.emailVerified;
}

async function tenant(): Promise<{ name: string; id: string }> {
  const name = `ev-${newId()}`;
  const made = await seed(['tenant', '--name', name]);
  return { name, id: made.tenantId };
}

describe('seed user --email-verified', () => {
  it('creates the user with the address verified', async () => {
    const t = await tenant();
    await seed([
      'user',
      '--tenant',
      t.name,
      '--username',
      'ada',
      '--password',
      PASSWORD,
      '--email',
      'ada@example.test',
      '--email-verified',
    ]);
    expect(await verified(t.id, 'ada')).toBe(true);
  });

  it('leaves the address unverified without the flag', async () => {
    const t = await tenant();
    await seed([
      'user',
      '--tenant',
      t.name,
      '--username',
      'bob',
      '--password',
      PASSWORD,
      '--email',
      'bob@example.test',
    ]);
    expect(await verified(t.id, 'bob')).toBe(false);
  });

  it('refuses the flag with no --email, and creates no user', async () => {
    const t = await tenant();
    await expect(
      seed([
        'user',
        '--tenant',
        t.name,
        '--username',
        'cy',
        '--password',
        PASSWORD,
        '--email-verified',
      ]),
    ).rejects.toMatchObject({ code: 'seed_invalid_options' });
    expect(await verified(t.id, 'cy')).toBeUndefined();
  });

  it('verifies in the tenant it names and no other', async () => {
    const a = await tenant();
    const b = await tenant();
    for (const t of [a, b]) {
      await seed([
        'user',
        '--tenant',
        t.name,
        '--username',
        'dee',
        '--password',
        PASSWORD,
        '--email',
        'dee@example.test',
        ...(t === a ? ['--email-verified'] : []),
      ]);
    }
    expect(await verified(a.id, 'dee')).toBe(true);
    expect(await verified(b.id, 'dee')).toBe(false);
  });
});

describe('seed profile --email-verified', () => {
  it('marks an existing address verified, in that tenant only', async () => {
    const a = await tenant();
    const b = await tenant();
    for (const t of [a, b]) {
      await seed([
        'user',
        '--tenant',
        t.name,
        '--username',
        'eve',
        '--password',
        PASSWORD,
        '--email',
        'eve@example.test',
      ]);
    }
    await seed(['profile', '--tenant', a.name, '--username', 'eve', '--email-verified']);
    expect(await verified(a.id, 'eve')).toBe(true);
    expect(await verified(b.id, 'eve')).toBe(false);
  });

  it('can be combined with other profile fields', async () => {
    const t = await tenant();
    await seed([
      'user',
      '--tenant',
      t.name,
      '--username',
      'fay',
      '--password',
      PASSWORD,
      '--email',
      'fay@example.test',
    ]);
    await seed([
      'profile',
      '--tenant',
      t.name,
      '--username',
      'fay',
      '--name',
      'Fay Wray',
      '--email-verified',
    ]);
    expect(await verified(t.id, 'fay')).toBe(true);
  });

  it('refuses a user with no address, and changes nothing', async () => {
    const t = await tenant();
    await seed(['user', '--tenant', t.name, '--username', 'gus', '--password', PASSWORD]);
    await expect(
      seed(['profile', '--tenant', t.name, '--username', 'gus', '--email-verified']),
    ).rejects.toMatchObject({ code: 'seed_invalid_options' });
    expect(await verified(t.id, 'gus')).toBe(false);
  });
});
