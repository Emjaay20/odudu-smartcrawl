import { createDatabase, MIGRATIONS_DIR, runMigrations, type DatabaseHandle } from '@odudu/db';
import { users } from '@odudu/domain-identity';
import { newId } from '@odudu/kernel';
import { tenantLookupRepository } from '@odudu/protocol-oidc';
import { createAppRole, startTestDatabase, type TestDatabase } from '@odudu/testkit';
import { and, eq } from 'drizzle-orm';
import { spawnSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seed } from '#/cli/seed';

// Every command an operator types writes through a repository that refuses a
// bidirectional control, so none of them can plant one an API or a form
// would have refused.

const RLO = String.fromCodePoint(0x202e);
const ISOLATE = String.fromCodePoint(0x2066);
const PASSWORD = 'correct horse battery';

let containerHandle: TestDatabase | undefined;
let ownerHandle: DatabaseHandle | undefined;
let owner: DatabaseHandle;

beforeAll(async () => {
  containerHandle = await startTestDatabase();
  ownerHandle = createDatabase(containerHandle.adminUrl);
  owner = ownerHandle;
  await runMigrations(owner.db, MIGRATIONS_DIR);
  const appUrl = await createAppRole(containerHandle.adminUrl);
  process.env.ODUDU_DATABASE_URL = containerHandle.adminUrl;
  process.env.ODUDU_APP_DATABASE_URL = appUrl;
  process.env.ODUDU_KEK = Buffer.alloc(32, 7).toString('base64');
}, 120_000);

afterAll(async () => {
  delete process.env.ODUDU_DATABASE_URL;
  delete process.env.ODUDU_APP_DATABASE_URL;
  delete process.env.ODUDU_KEK;
  await ownerHandle?.close();
  await containerHandle?.stop();
});

const refused = { code: 'bidi_control_refused' };

async function userRows(tenantId: string, username: string) {
  return owner.db
    .select({ username: users.username })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.username, username)));
}

describe('the seed CLI refuses a bidirectional control', () => {
  it('in the username of seed user, and creates no user', async () => {
    const tenantName = `bidi-${newId()}`;
    const tenant = await seed(['tenant', '--name', tenantName]);
    await expect(
      seed(['user', '--tenant', tenantName, '--username', `ada${RLO}`, '--password', PASSWORD]),
    ).rejects.toMatchObject(refused);
    expect(await userRows(tenant.tenantId, `ada${RLO}`)).toEqual([]);
  });

  it('in the username of the bootstrap form', async () => {
    const tenantName = `bidi-${newId()}`;
    await expect(
      seed({
        tenant: tenantName,
        clientId: 'app',
        redirectUris: ['https://app.example/cb'],
        username: `ada${ISOLATE}`,
        password: PASSWORD,
      }),
    ).rejects.toMatchObject(refused);
  });

  it('in a profile name, a role name and a group name', async () => {
    const tenantName = `bidi-${newId()}`;
    await seed(['tenant', '--name', tenantName]);
    await seed(['user', '--tenant', tenantName, '--username', 'ada', '--password', PASSWORD]);
    await expect(
      seed(['profile', '--tenant', tenantName, '--username', 'ada', '--given-name', `A${RLO}`]),
    ).rejects.toMatchObject(refused);
    await expect(
      seed(['role', '--tenant', tenantName, '--name', `admin${RLO}`]),
    ).rejects.toMatchObject(refused);
    await expect(
      seed(['group', '--tenant', tenantName, '--name', `staff${RLO}`]),
    ).rejects.toMatchObject(refused);
  });

  it('in the display name given to a tenant as a setting', async () => {
    const tenantName = `bidi-${newId()}`;
    await expect(
      seed(['tenant', '--name', tenantName, '--set', `display_name=Acme${RLO}`]),
    ).rejects.toMatchObject(refused);
  });

  it('in the display name the tenant lookup is asked to create', async () => {
    await expect(
      tenantLookupRepository(owner.db).create({
        id: newId(),
        name: `bidi-${newId()}`,
        displayName: `Acme${RLO}`,
      }),
    ).rejects.toMatchObject(refused);
  });

  it('in the username of the system administrator', async () => {
    const { seedAdmin } = await import('#/cli/seed');
    await expect(seedAdmin({ username: `root${RLO}` })).rejects.toMatchObject(refused);
  });

  it('and takes plain right-to-left text, which then reads back', async () => {
    const tenantName = `bidi-${newId()}`;
    const tenant = await seed(['tenant', '--name', tenantName]);
    await seed(['user', '--tenant', tenantName, '--username', 'مستخدم', '--password', PASSWORD]);
    await seed(['profile', '--tenant', tenantName, '--username', 'مستخدم', '--given-name', 'שלום']);
    const rows = await owner.db
      .select({ givenName: users.givenName })
      .from(users)
      .where(and(eq(users.tenantId, tenant.tenantId), eq(users.username, 'مستخدم')));
    expect(rows[0]?.givenName).toBe('שלום');
  });

  it('stops the command with one line on stderr and exit status 1, not a stack', async () => {
    const tenantName = `bidi-${newId()}`;
    await seed(['tenant', '--name', tenantName]);
    const run = spawnSync(
      process.execPath,
      [
        'src/main.ts',
        'seed',
        'user',
        '--tenant',
        tenantName,
        '--username',
        `ada${RLO}`,
        '--password',
        PASSWORD,
      ],
      { cwd: new URL('..', import.meta.url).pathname, env: process.env, encoding: 'utf8' },
    );
    expect(run.status).toBe(1);
    const lines = run.stderr
      .split('\n')
      .filter((line) => !/ExperimentalWarning|trace-warnings/u.test(line) && line !== '');
    expect(lines).toEqual([
      'error: username must not contain bidirectional control characters (U+202A to U+202E, U+2066 to U+2069)',
    ]);
  });
});
