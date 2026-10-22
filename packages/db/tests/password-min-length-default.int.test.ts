import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTestDatabase, type TestDatabase } from '@odudu/testkit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseHandle } from '#/client';
import { MIGRATIONS_DIR, runMigrations } from '#/migrate';

const TAG = '0102_password_min_length_default';

let containerHandle: TestDatabase | undefined;
let dbHandle: DatabaseHandle | undefined;
let before: string | undefined;

beforeAll(async () => {
  containerHandle = await startTestDatabase();
  dbHandle = createDatabase(containerHandle.adminUrl);

  // The migrations up to the one under test, so a tenant can exist before it.
  before = mkdtempSync(join(tmpdir(), 'odudu-migrations-'));
  cpSync(MIGRATIONS_DIR, before, { recursive: true });
  const journalPath = join(before, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
    entries: { tag: string }[];
  };
  journal.entries = journal.entries.filter((entry) => entry.tag < TAG);
  writeFileSync(journalPath, JSON.stringify(journal));
  await runMigrations(dbHandle.db, before);
}, 120_000);

afterAll(async () => {
  if (before !== undefined) rmSync(before, { recursive: true, force: true });
  await dbHandle?.close();
  await containerHandle?.stop();
});

describe('the password minimum length default', () => {
  it('changes for new tenants only, leaving existing ones as they were', async () => {
    const handle = dbHandle;
    if (handle === undefined) throw new Error('database not started');
    await handle.sql`insert into tenants (id, name) values (gen_random_uuid(), 'existing')`;
    await handle.sql`
      insert into tenants (id, name, password_min_length)
      values (gen_random_uuid(), 'chosen', 12)`;

    await runMigrations(handle.db, MIGRATIONS_DIR);
    await handle.sql`insert into tenants (id, name) values (gen_random_uuid(), 'fresh')`;

    const rows = await handle.sql<{ name: string; password_min_length: number }[]>`
      select name, password_min_length from tenants
      where name in ('existing', 'chosen', 'fresh')`;
    const lengths = Object.fromEntries(rows.map((row) => [row.name, row.password_min_length]));
    expect(lengths).toEqual({ existing: 8, chosen: 12, fresh: 15 });
  });

  it('keeps the bounds at 8 to 256', async () => {
    const handle = dbHandle;
    if (handle === undefined) throw new Error('database not started');
    await expect(
      handle.sql`insert into tenants (id, name, password_min_length)
        values (gen_random_uuid(), 'too-short', 7)`,
    ).rejects.toThrow();
    await expect(
      handle.sql`insert into tenants (id, name, password_min_length)
        values (gen_random_uuid(), 'eight', 8), (gen_random_uuid(), 'max', 256)`,
    ).resolves.toBeDefined();
    await expect(
      handle.sql`insert into tenants (id, name, password_min_length)
        values (gen_random_uuid(), 'too-long', 257)`,
    ).rejects.toThrow();
  });
});
