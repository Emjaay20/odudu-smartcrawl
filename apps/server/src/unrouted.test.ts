import { type DatabaseHandle } from '@odudu/db';
import { loadConfig } from '@odudu/kernel';
import { describe, expect, it } from 'vitest';
import { buildApp } from '#/app';
import { createLogger } from '#/logger';

const config = loadConfig({
  ODUDU_DATABASE_URL: 'postgres://u:p@localhost:5432/odudu',
  ODUDU_KEK: Buffer.alloc(32, 9).toString('base64'),
  ODUDU_LOG_LEVEL: 'silent',
});

const BROWSER = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

function refuse(): never {
  throw new Error('an unrouted request touched the database');
}

// Any use of the database at all is a failure: an address nothing serves, and
// a failure nothing handled, cost the same whatever tenant they name, so
// neither may ask who is calling.
const forbidden: DatabaseHandle = {
  db: new Proxy({}, { get: refuse }) as DatabaseHandle['db'],
  sql: new Proxy(() => undefined, {
    get: refuse,
    apply: refuse,
  }) as unknown as DatabaseHandle['sql'],
  close: () => Promise.resolve(),
};

function app(): ReturnType<typeof buildApp> {
  return buildApp({
    database: forbidden,
    ownerDatabase: forbidden,
    kek: config.ODUDU_KEK,
    logger: createLogger(config),
    docsDir: undefined,
  });
}

describe('an address nothing serves', () => {
  it('is answered without touching the database, for a page and for a program', async () => {
    const server = app();
    for (const url of ['/nope', '/tenants/acme/nope', '/tenants/no-such-tenant/nope/deeper']) {
      for (const accept of [BROWSER, 'application/json', undefined]) {
        const res = await server.inject({
          url,
          ...(accept === undefined ? {} : { headers: { accept } }),
        });
        expect(res.statusCode, `${url} ${String(accept)}`).toBe(404);
      }
    }
    await server.close();
  });

  it('looks the same for a tenant that exists and one that does not, by its bytes', async () => {
    const server = app();
    const a = await server.inject({ url: '/tenants/acme/nope', headers: { accept: BROWSER } });
    const b = await server.inject({ url: '/tenants/zzzz/nope', headers: { accept: BROWSER } });
    expect(a.body).toBe(b.body);
    expect(a.statusCode).toBe(b.statusCode);
    await server.close();
  });

  it('keeps no per-path state: repeating a thousand distinct paths adds no growth', async () => {
    const server = app();
    const heapBefore = process.memoryUsage().heapUsed;
    for (let i = 0; i < 1000; i += 1) {
      await server.inject({
        url: `/p/${String(i)}/${'x'.repeat(200)}`,
        headers: { accept: BROWSER },
      });
    }
    expect(process.memoryUsage().heapUsed - heapBefore).toBeLessThan(32 * 1024 * 1024);
    await server.close();
  });
});

describe('a failure nothing handled', () => {
  it('is answered without touching the database', async () => {
    const server = app();
    server.get('/boom', () => {
      throw new Error('x');
    });
    for (const accept of [BROWSER, 'application/json']) {
      const res = await server.inject({ url: '/boom', headers: { accept } });
      expect(res.statusCode).toBe(500);
    }
    await server.close();
  });
});
