import { newId } from '@odudu/kernel';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startAdminFixture, type AdminFixture } from '#/testing/admin-fixture';

// An audit read that outlives its bound is refused with a typed problem. The
// bound is shortened to a few milliseconds, and the read that must outlive it
// is held on a lock instead of racing a query plan: whether a two-filter
// intersection over 600,000 rows finishes inside 25 ms depends on the planner
// and the machine, whereas a read waiting on a lock cannot finish before the
// statement timeout cancels it.
const TIMEOUT_MS = 25;
const ROWS = 600_000;

let handle: AdminFixture | undefined;
let fixture: AdminFixture;
let tenantName: string;
let token: string;
const ACTOR = newId();
const OTHER_ACTOR = newId();

beforeAll(async () => {
  handle = await startAdminFixture({ auditReadTimeoutMs: TIMEOUT_MS });
  fixture = handle;
  tenantName = `bound-${newId()}`;
  const tenant = await fixture.createTenant(tenantName);
  token = await fixture.adminToken(tenantName, ['view-audit']);
  await fixture.owner.sql`
    insert into audit_events
      (id, tenant_id, occurred_at, event_type, action, outcome, actor_subject_id, resource_type, resource_id)
    select gen_random_uuid(), ${tenant.id}, now() - (n || ' seconds')::interval,
           'admin_mutation', case when n % 2 = 0 then 'bulk.one' else 'bulk.two' end, 'allowed',
           case when n % 2 = 0 then ${ACTOR}::uuid else ${OTHER_ACTOR}::uuid end, 'e2e', n::text
      from generate_series(1, ${ROWS}) n`;
  await fixture.owner.sql`analyze audit_events`;
}, 300_000);
afterAll(async () => {
  await handle?.stop();
});

function get(tail: string) {
  return fixture.http.inject({
    method: 'GET',
    url: `/admin/tenants/${tenantName}/${tail}`,
    headers: { authorization: `Bearer ${token}` },
  });
}

const BROAD = `action=bulk.one&actor_subject_id=${OTHER_ACTOR}`;

async function whileAuditEventsAreLocked(run: () => Promise<void>): Promise<void> {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let locked: () => void = () => undefined;
  const acquired = new Promise<void>((resolve) => {
    locked = resolve;
  });
  const holder = fixture.owner.sql.begin(async (tx) => {
    await tx`lock table audit_events in access exclusive mode`;
    locked();
    await held;
  });
  await acquired;
  try {
    await run();
  } finally {
    release();
    await holder;
  }
}

describe('an audit read whose filters cannot be served within the bound', () => {
  it.each(['audit', 'audit/count', 'audit/export'])(
    'is refused on %s with the typed problem, saying to narrow the time range',
    async (route) => {
      await whileAuditEventsAreLocked(async () => {
        const res = await get(`${route}?${BROAD}`);
        expect(res.statusCode).toBe(400);
        expect(res.headers['content-type']).toContain('application/problem+json');
        expect(res.json()).toMatchObject({
          type: 'about:blank#audit-query-too-broad',
          status: 400,
          detail: expect.stringContaining('narrow the time range with from and to') as unknown,
        });
      });
    },
  );

  it('is served when the time range makes it cheap', async () => {
    const from = new Date(Date.now() - 60_000).toISOString();
    const res = await get(`audit?${BROAD}&from=${from}`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [] });
  });

  it('leaves a single filter, and a page of the newest rows, inside the bound', async () => {
    for (const query of [
      'limit=1',
      'action=bulk.one&limit=5',
      `actor_subject_id=${ACTOR}&limit=5`,
    ]) {
      const res = await get(`audit?${query}`);
      expect(res.statusCode, query).toBe(200);
    }
  });

  it('ends its transaction: the connection returns to the pool with no bound left on it', async () => {
    await whileAuditEventsAreLocked(async () => {
      for (let i = 0; i < 12; i += 1) {
        expect((await get(`audit?${BROAD}`)).statusCode).toBe(400);
      }
    });
    const [row] = await fixture.app.sql<
      { timeout: string }[]
    >`select current_setting('statement_timeout') as timeout`;
    expect(row?.timeout).toBe('0');
    expect((await get('audit?limit=1')).statusCode).toBe(200);
  });
});
