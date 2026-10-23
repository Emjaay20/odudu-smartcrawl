import {
  createDatabase,
  MIGRATIONS_DIR,
  runMigrations,
  tenants,
  withTenant,
  type DatabaseHandle,
} from '@odudu/db';
import { BidiControlError, newId } from '@odudu/kernel';
import { createAppRole, startTestDatabase, type TestDatabase } from '@odudu/testkit';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { groupRepository } from '#/repository/groups';
import { roleRepository } from '#/repository/roles';

const RLO = String.fromCodePoint(0x202e);

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

describe('a bidirectional control in a role or group name', () => {
  it('is refused, and plain right-to-left names are taken', async () => {
    const tenantId = await tenant();
    await expect(
      withTenant(app.db, tenantId, (tx) =>
        roleRepository(tx).create({ tenantId, name: `r${RLO}` }),
      ),
    ).rejects.toBeInstanceOf(BidiControlError);
    await expect(
      withTenant(app.db, tenantId, (tx) =>
        groupRepository(tx).create({ tenantId, name: `g${RLO}`, parentId: null }),
      ),
    ).rejects.toMatchObject({ code: 'bidi_control_refused', field: 'name' });

    const role = await withTenant(app.db, tenantId, (tx) =>
      roleRepository(tx).create({ tenantId, name: 'مدير' }),
    );
    const group = await withTenant(app.db, tenantId, (tx) =>
      groupRepository(tx).create({ tenantId, name: 'צוות', parentId: null }),
    );
    expect(role.name).toBe('مدير');
    expect(group.path).toBe('/צוות');
  });

  it('is refused in a description, except the stored one', async () => {
    const tenantId = await tenant();
    await expect(
      withTenant(app.db, tenantId, (tx) =>
        roleRepository(tx).create({ tenantId, name: 'r', description: `d${RLO}` }),
      ),
    ).rejects.toMatchObject({ field: 'description' });
    await expect(
      withTenant(app.db, tenantId, (tx) =>
        groupRepository(tx).create({ tenantId, name: 'g', description: `d${RLO}`, parentId: null }),
      ),
    ).rejects.toMatchObject({ field: 'description' });

    const legacy = `old${RLO}text`;
    const role = await withTenant(app.db, tenantId, (tx) =>
      roleRepository(tx).create({ tenantId, name: 'r2', description: 'D' }),
    );
    const group = await withTenant(app.db, tenantId, (tx) =>
      groupRepository(tx).create({ tenantId, name: 'g2', description: 'D', parentId: null }),
    );
    await owner.db.execute(sql`update roles set description = ${legacy} where id = ${role.id}`);
    await owner.db.execute(sql`update groups set description = ${legacy} where id = ${group.id}`);
    await withTenant(app.db, tenantId, (tx) =>
      roleRepository(tx).amend(role.id, { description: legacy }),
    );
    await withTenant(app.db, tenantId, (tx) =>
      groupRepository(tx).setDescription(group.id, legacy),
    );
    await expect(
      withTenant(app.db, tenantId, (tx) =>
        groupRepository(tx).setDescription(group.id, `${legacy}!`),
      ),
    ).rejects.toMatchObject({ field: 'description' });
    await expect(
      withTenant(app.db, tenantId, (tx) =>
        roleRepository(tx).amend(role.id, { description: `${legacy}!` }),
      ),
    ).rejects.toMatchObject({ field: 'description' });
  });
});
