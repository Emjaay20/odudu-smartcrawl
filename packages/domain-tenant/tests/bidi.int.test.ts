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

  it('is refused in a client_id, a client description, a scope description and consent text', async () => {
    const tenantId = await tenant();
    const client = {
      tenantId,
      clientId: 'app',
      name: 'App',
      type: 'public',
      secretHash: null,
    } as const;
    await expect(
      withTenant(app.db, tenantId, (tx) =>
        clientRepository(tx).create({ ...client, clientId: `app${RLO}` }),
      ),
    ).rejects.toMatchObject({ field: 'client_id' });
    await expect(
      withTenant(app.db, tenantId, (tx) =>
        clientRepository(tx).create({ ...client, description: `d${RLO}` }),
      ),
    ).rejects.toMatchObject({ field: 'description' });
    await expect(
      withTenant(app.db, tenantId, (tx) =>
        clientScopeRepository(tx).create({ tenantId, name: 'orders', description: `d${RLO}` }),
      ),
    ).rejects.toMatchObject({ field: 'description' });
    await expect(
      withTenant(app.db, tenantId, (tx) =>
        clientScopeRepository(tx).create({ tenantId, name: 'orders', consentText: `c${RLO}` }),
      ),
    ).rejects.toMatchObject({ field: 'consent_text' });
  });

  it('lets a stored name, description, consent text and display name stand while another field changes', async () => {
    const tenantId = await tenant();
    const legacy = `old${RLO}text`;
    const client = await withTenant(app.db, tenantId, (tx) =>
      clientRepository(tx).create({
        tenantId,
        clientId: 'app',
        name: 'App',
        description: 'D',
        type: 'public',
        secretHash: null,
      }),
    );
    const scope = await withTenant(app.db, tenantId, (tx) =>
      clientScopeRepository(tx).create({
        tenantId,
        name: 'orders',
        description: 'D',
        consentText: 'C',
      }),
    );
    await owner.db.execute(
      sql`update clients set name = ${legacy}, description = ${legacy} where id = ${client.id}`,
    );
    await owner.db.execute(
      sql`update client_scopes set description = ${legacy}, consent_text = ${legacy} where id = ${scope.id}`,
    );
    await owner.db.execute(sql`update tenants set display_name = ${legacy} where id = ${tenantId}`);

    const updated = await withTenant(app.db, tenantId, (tx) =>
      clientRepository(tx).update(client.id, { name: legacy, description: legacy, enabled: false }),
    );
    expect(updated.name).toBe(legacy);
    const amended = await withTenant(app.db, tenantId, (tx) =>
      clientScopeRepository(tx).amend(scope.id, {
        description: legacy,
        consentText: legacy,
        displayOrder: 3,
      }),
    );
    expect(amended.consentText).toBe(legacy);
    const settings = await withTenant(app.db, tenantId, (tx) =>
      tenantSettingsRepository(tx).amend(tenantId, { displayName: legacy, enabled: true }),
    );
    expect(settings.display_name).toBe(legacy);
    await expect(
      withTenant(app.db, tenantId, (tx) =>
        clientScopeRepository(tx).amend(scope.id, { consentText: `${legacy}!` }),
      ),
    ).rejects.toMatchObject({ field: 'consent_text' });
  });
});
