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
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clientRepository } from '#/repository/clients';
import { clientScopeRepository } from '#/repository/client-scopes';
import { tenantSettingsRepository } from '#/repository/tenant-settings';

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

describe('a bidirectional control in a name a tenant package writes', () => {
  it('is refused in a client name on creation, and no client is written', async () => {
    const tenantId = await tenant();
    await expect(
      withTenant(app.db, tenantId, (tx) =>
        clientRepository(tx).create({
          tenantId,
          clientId: 'bank',
          name: `Bank${RLO}`,
          type: 'public',
          secretHash: null,
        }),
      ),
    ).rejects.toBeInstanceOf(BidiControlError);
    const found = await withTenant(app.db, tenantId, (tx) =>
      clientRepository(tx).byClientId('bank'),
    );
    expect(found).toBeNull();
  });

  it('is refused in a client name on amendment, and takes right-to-left text', async () => {
    const tenantId = await tenant();
    const client = await withTenant(app.db, tenantId, (tx) =>
      clientRepository(tx).create({
        tenantId,
        clientId: 'bank',
        name: 'Bank',
        type: 'public',
        secretHash: null,
      }),
    );
    await expect(
      withTenant(app.db, tenantId, (tx) =>
        clientRepository(tx).update(client.id, { name: `Bank${RLO}` }),
      ),
    ).rejects.toMatchObject({ code: 'bidi_control_refused', field: 'name' });
    const arabic = await withTenant(app.db, tenantId, (tx) =>
      clientRepository(tx).update(client.id, { name: 'مصرف' }),
    );
    expect(arabic.name).toBe('مصرف');
  });

  it('is refused in a scope name', async () => {
    const tenantId = await tenant();
    await expect(
      withTenant(app.db, tenantId, (tx) =>
        clientScopeRepository(tx).create({ tenantId, name: `scope${RLO}` }),
      ),
    ).rejects.toBeInstanceOf(BidiControlError);
  });

  it('is refused in a tenant display name, leaving the stored one', async () => {
    const tenantId = await tenant();
    await withTenant(app.db, tenantId, (tx) =>
      tenantSettingsRepository(tx).amend(tenantId, { displayName: 'Acme' }),
    );
    await expect(
      withTenant(app.db, tenantId, (tx) =>
        tenantSettingsRepository(tx).amend(tenantId, { displayName: `Acme${RLO}` }),
      ),
    ).rejects.toMatchObject({ code: 'bidi_control_refused', field: 'display_name' });
    const stored = await withTenant(app.db, tenantId, (tx) =>
      tenantSettingsRepository(tx).byId(tenantId),
    );
    expect(stored?.display_name).toBe('Acme');
  });
});
