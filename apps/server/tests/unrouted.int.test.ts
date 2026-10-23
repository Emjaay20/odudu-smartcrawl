import { createDatabase, MIGRATIONS_DIR, runMigrations, type DatabaseHandle } from '@odudu/db';
import { loadConfig, newId } from '@odudu/kernel';
import { createAppRole, startTestDatabase, type TestDatabase } from '@odudu/testkit';
import { type FastifyInstance } from 'fastify';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '#/app';
import { seed } from '#/cli/seed';
import { createLogger } from '#/logger';
import { CONSOLE_KEYS } from '#/testing/console-key';

// An address nothing serves, answered through the real composition root: the
// admin plugin, the OIDC routes and the console gateway all registered, so the
// answer is the one the server gives and not one a unit built for itself.

let containerHandle: TestDatabase | undefined;
let ownerHandle: DatabaseHandle | undefined;
let appHandle: DatabaseHandle | undefined;
let owner: DatabaseHandle;
let appDb: DatabaseHandle;
let docs: string;

const KEK = Buffer.alloc(32, 7);
const BROWSER = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
const CONSOLE = 'https://console.example.test';

beforeAll(async () => {
  containerHandle = await startTestDatabase();
  ownerHandle = createDatabase(containerHandle.adminUrl);
  owner = ownerHandle;
  await runMigrations(owner.db, MIGRATIONS_DIR);
  const appUrl = await createAppRole(containerHandle.adminUrl);
  appHandle = createDatabase(appUrl, { max: 5 });
  appDb = appHandle;
  process.env.ODUDU_DATABASE_URL = containerHandle.adminUrl;
  process.env.ODUDU_APP_DATABASE_URL = appUrl;
  process.env.ODUDU_KEK = KEK.toString('base64');
  docs = await mkdtemp(join(tmpdir(), 'unrouted-docs-'));
  await mkdir(docs, { recursive: true });
  await writeFile(join(docs, 'index.html'), '<!doctype html><title>Docs</title>');
  await writeFile(
    join(docs, 'csp.json'),
    JSON.stringify({ scriptHashes: [`sha256-${'A'.repeat(43)}=`], styleAttributeHashes: [] }),
  );
}, 120_000);

afterAll(async () => {
  delete process.env.ODUDU_DATABASE_URL;
  delete process.env.ODUDU_APP_DATABASE_URL;
  delete process.env.ODUDU_KEK;
  await rm(docs, { recursive: true, force: true });
  await appHandle?.close();
  await ownerHandle?.close();
  await containerHandle?.stop();
});

function server(
  extra: Partial<Parameters<typeof buildApp>[0]> = {},
  beforeReady?: (app: FastifyInstance) => void,
): FastifyInstance {
  const config = loadConfig({ ...process.env, ODUDU_LOG_LEVEL: 'silent' });
  const app = buildApp({
    tls: false,
    database: appDb,
    ownerDatabase: owner,
    kek: KEK,
    logger: createLogger(config),
    publicBaseUrl: 'https://idp.example.test',
    ...extra,
  });
  beforeReady?.(app);
  return app;
}

function withConsoleAndDocs(beforeReady?: (app: FastifyInstance) => void): FastifyInstance {
  return server(
    {
      consoleBaseUrl: CONSOLE,
      consoleKeys: CONSOLE_KEYS,
      consoleDir: '/nonexistent/odudu-unrouted-fixture',
      docsDir: docs,
    },
    beforeReady,
  );
}

describe('a browser asking for an address nothing serves', () => {
  it('gets the branded page with the headers every page carries', async () => {
    const app = withConsoleAndDocs();
    const res = await app.inject({ url: '/nope', headers: { accept: BROWSER } });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toMatch(/^text\/html/u);
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers.vary).toContain('Accept');
    expect(res.headers['content-language']).toBe('en');
    expect(res.body).toContain('<h1>Page not found</h1>');
    expect(res.body).toContain('class="mark"');
    expect(res.body).toContain(`href="${CONSOLE}/console/"`);
    expect(res.body).toContain('href="/docs/"');
    await app.close();
  });

  it('is not offered a documentation link when the documentation is off', async () => {
    const app = server({
      consoleBaseUrl: CONSOLE,
      consoleKeys: CONSOLE_KEYS,
      consoleDir: '/nonexistent/odudu-unrouted-fixture',
    });
    const res = await app.inject({ url: '/nope', headers: { accept: BROWSER } });
    expect(res.body).not.toContain('/docs/');
    expect(res.body).toContain('/console/');
    await app.close();
  });

  it('is not offered a console link when the console is off', async () => {
    const app = server();
    const res = await app.inject({ url: '/nope', headers: { accept: BROWSER } });
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toContain('/console/');
    expect(res.body).not.toContain('<a ');
    await app.close();
  });

  it('cannot tell a tenant that exists from one that does not', async () => {
    const name = `unrouted-${newId()}`;
    await seed({
      tenant: name,
      clientId: 'unrouted-spa',
      redirectUris: ['https://app.example/callback'],
    });
    const app = withConsoleAndDocs();
    const known = await app.inject({
      url: `/tenants/${name}/login-actions/nope`,
      headers: { accept: BROWSER },
    });
    const unknown = await app.inject({
      url: `/tenants/${name}-missing/login-actions/nope`,
      headers: { accept: BROWSER },
    });
    const bare = await app.inject({ url: '/nope', headers: { accept: BROWSER } });
    expect(known.statusCode).toBe(404);
    expect(unknown.statusCode).toBe(404);
    expect(unknown.body).toBe(known.body);
    expect(known.body).toBe(bare.body);
    expect(known.body).not.toContain(name);
    await app.close();
  });

  it('is answered the same for HEAD: the status, the headers and the length of the GET', async () => {
    const app = withConsoleAndDocs();
    const headers = { accept: BROWSER };
    const get = await app.inject({ url: '/nope', headers });
    const head = await app.inject({ method: 'HEAD', url: '/nope', headers });
    expect(head.statusCode).toBe(404);
    expect(head.headers['content-type']).toMatch(/^text\/html/u);
    expect(head.headers['content-length']).toBe(String(Buffer.byteLength(get.body)));
    await app.close();
  });

  it('is shown the problem document under every API prefix', async () => {
    const app = withConsoleAndDocs();
    for (const url of [
      '/admin/nope',
      '/admin/tenants/anything/nope',
      '/health/nope',
      '/console/api/nope',
      '/tenants/anything/protocol/openid-connect/nope',
      '/tenants/anything/.well-known/nope',
      '/tenants/anything/clients-registrations/openid-connect/nope',
      '/tenants/anything/nope',
    ]) {
      const res = await app.inject({
        url,
        headers: { accept: BROWSER, host: 'console.example.test' },
      });
      expect(res.statusCode, url).toBe(404);
      expect(res.headers['content-type'], url).toMatch(/^application\/problem\+json/u);
    }
    await app.close();
  });
});

describe('a program asking for an address nothing serves', () => {
  it('gets a problem document that names no route and no path', async () => {
    const app = withConsoleAndDocs();
    for (const url of ['/nope', '/tenants/anything/nope', '/health/nope', '/admin/nope']) {
      const res = await app.inject({ url });
      expect(res.statusCode, url).toBe(404);
      expect(res.headers['content-type'], url).toMatch(/^application\/problem\+json/u);
      const body = res.json<{ detail: string; instance: string; type: string }>();
      expect(body.detail, url).toBe('No resource at this path');
      expect(body.type).toBe('about:blank#not-found');
      expect(body.instance).toBe(res.headers['x-request-id']);
    }
    await app.close();
  });

  it('is not answered with a page for a method that is not a navigation', async () => {
    const app = withConsoleAndDocs();
    const res = await app.inject({ method: 'POST', url: '/nope', headers: { accept: BROWSER } });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/u);
    await app.close();
  });
});

describe('a failure nothing handled', () => {
  const boom = (app: FastifyInstance): void => {
    app.get('/boom', () => {
      throw new Error('relation "secret_table" does not exist');
    });
  };

  it('is a fixed page with the request id for a browser, not the message', async () => {
    const app = withConsoleAndDocs(boom);
    const res = await app.inject({
      url: '/boom',
      headers: { accept: BROWSER, 'x-request-id': 'trace-123' },
    });
    expect(res.statusCode).toBe(500);
    expect(res.headers['content-type']).toMatch(/^text\/html/u);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers.vary).toContain('Accept');
    expect(res.body).toContain('Something went wrong');
    expect(res.body).toContain('trace-123');
    expect(res.body).not.toContain('secret_table');
    await app.close();
  });

  it('is the problem document for a program, as before', async () => {
    const app = withConsoleAndDocs(boom);
    const res = await app.inject({ url: '/boom', headers: { accept: 'application/json' } });
    expect(res.statusCode).toBe(500);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/u);
    expect(res.json()).toMatchObject({ status: 500, title: 'Internal Server Error' });
    expect(res.body).not.toContain('secret_table');
    await app.close();
  });
});
