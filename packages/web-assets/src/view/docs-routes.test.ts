import Fastify, { type FastifyInstance } from 'fastify';
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { docsPolicy } from '#/service/docs-policy';
import { docsRoutes } from '#/view/docs-routes';

const SCRIPT = `sha256-${'A'.repeat(43)}=`;
const STYLE = `sha256-${'b'.repeat(43)}=`;
const POLICY = docsPolicy({ scriptHashes: [SCRIPT], styleAttributeHashes: [STYLE] });
const CHUNK = 'assets/js/main.04cfb3a2.js';
const dirs: string[] = [];
let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tmp(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'docs-'));
  dirs.push(dir);
  return dir;
}

async function put(dir: string, path: string, content: string): Promise<void> {
  const full = join(dir, path);
  await mkdir(join(full, '..'), { recursive: true });
  await writeFile(full, content);
}

async function builtDir(): Promise<string> {
  const dir = await tmp();
  await put(dir, 'index.html', '<!doctype html><title>Documentation home</title>');
  await put(dir, '404.html', '<!doctype html><title>Page not found</title>');
  await put(dir, 'guides/index.html', '<!doctype html><title>Guides</title>');
  await put(dir, CHUNK, 'console.log(1)');
  await put(dir, 'assets/css/styles.886e0661.css', 'body{margin:0}');
  await put(dir, 'search-index.json', '[]');
  await put(dir, 'robots.txt', 'User-agent: *\nDisallow: /\n');
  await put(dir, 'llms.txt', '# Odudu');
  await put(dir, 'llms-full.txt', '# Odudu, in full');
  await put(dir, 'introduction.md', '# Introduction');
  await put(
    dir,
    'csp.json',
    JSON.stringify({ scriptHashes: [SCRIPT], styleAttributeHashes: [STYLE] }),
  );
  await put(dir, '.hidden.html', 'secret');
  await put(dir, 'notes.exe', 'not a served type');
  return dir;
}

async function served(dir: string, logs: string[] = []): Promise<FastifyInstance> {
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      logs.push(chunk.toString('utf8'));
      done();
    },
  });
  const instance = Fastify({ logger: { level: 'warn', stream } });
  await instance.register(docsRoutes(dir));
  await instance.ready();
  app = instance;
  return instance;
}

describe('docsRoutes', () => {
  it('redirects /docs to /docs/ with 308', async () => {
    const server = await served(await builtDir());
    const response = await server.inject('/docs');
    expect(response.statusCode).toBe(308);
    expect(response.headers.location).toBe('/docs/');
    expect(response.headers['x-robots-tag']).toBe('noindex, nofollow');
  });

  it('serves the home page under the policy and the fixed page headers', async () => {
    const server = await served(await builtDir());
    const response = await server.inject('/docs/');
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(response.headers['content-security-policy']).toBe(POLICY);
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(response.headers['content-language']).toBe('en');
    expect(response.headers['cache-control']).toBe('no-cache');
    expect(response.body).toContain('Documentation home');
  });

  it('serves a section by its directory, and sends a section without the slash to it', async () => {
    const server = await served(await builtDir());
    expect((await server.inject('/docs/guides/')).body).toContain('Guides');
    const bare = await server.inject('/docs/guides?x=1');
    expect(bare.statusCode).toBe(308);
    expect(bare.headers.location).toBe('/docs/guides/?x=1');
  });

  it('serves a hashed asset as immutable', async () => {
    const server = await served(await builtDir());
    const response = await server.inject(`/docs/${CHUNK}`);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/javascript; charset=utf-8');
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(response.headers['x-robots-tag']).toBe('noindex, nofollow');
  });

  it.each([
    ['search-index.json', 'application/json'],
    ['robots.txt', 'text/plain; charset=utf-8'],
    ['llms.txt', 'text/plain; charset=utf-8'],
    ['llms-full.txt', 'text/plain; charset=utf-8'],
    ['introduction.md', 'text/markdown; charset=utf-8'],
  ])('serves the unhashed %s as %s and revalidates it', async (path, type) => {
    const server = await served(await builtDir());
    const response = await server.inject(`/docs/${path}`);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe(type);
    expect(response.headers['cache-control']).toBe('no-cache');
    expect(response.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('answers 304 to a matching etag, so a search index is not sent twice', async () => {
    const server = await served(await builtDir());
    const first = await server.inject('/docs/search-index.json');
    const etag = String(first.headers.etag);
    expect(etag).toMatch(/^"[A-Za-z0-9_-]+"$/u);
    const again = await server.inject({
      url: '/docs/search-index.json',
      headers: { 'if-none-match': etag },
    });
    expect(again.statusCode).toBe(304);
    expect(again.body).toBe('');
    expect(again.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(again.headers['content-security-policy']).toBe(POLICY);
  });

  it('answers an unknown path with the site’s own 404 page and status 404, not the home page', async () => {
    const server = await served(await builtDir());
    const response = await server.inject('/docs/nope/');
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(response.body).toContain('Page not found');
    expect(response.headers['content-security-policy']).toBe(POLICY);
    expect(response.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('answers 404 in plain text when the build has no 404 page', async () => {
    const dir = await builtDir();
    await rm(join(dir, '404.html'));
    const server = await served(dir);
    const response = await server.inject('/docs/nope');
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(response.headers['x-robots-tag']).toBe('noindex, nofollow');
  });

  it('never serves the policy file the build writes beside the site', async () => {
    const server = await served(await builtDir());
    expect((await server.inject('/docs/csp.json')).statusCode).toBe(404);
  });

  it('never serves a dotfile, a type it does not know, or a path that is not a key', async () => {
    const server = await served(await builtDir());
    for (const path of [
      '.hidden.html',
      'notes.exe',
      'index.html/',
      'assets/js/',
      'assets',
      'guides/index.html/x',
    ]) {
      const response = await server.inject(`/docs/${path}`);
      expect(response.statusCode, path).not.toBe(200);
    }
  });

  // `inject` resolves dot segments the way a URL parser does before the router
  // sees the path, so these end at a 404 outside /docs; the raw socket test
  // below sends them as written.
  it.each([
    '../package.json',
    '..%2fpackage.json',
    '%2e%2e/package.json',
    '%2e%2e%2fpackage.json',
    'assets/../../package.json',
    'assets/%2e%2e/%2e%2e/package.json',
    '..\\package.json',
    '%5c..%5cpackage.json',
    'index.html%00.png',
    '%00',
    'guides//index.html',
    '/etc/passwd',
    '%2fetc%2fpasswd',
    'assets%2fjs%2fmain.04cfb3a2.js%2f..%2f..%2f..',
  ])('answers 404 and reads nothing for %s', async (path) => {
    const server = await served(await builtDir());
    const response = await server.inject(`/docs/${path}`);
    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain('"name"');
    expect(response.body).not.toContain('root:');
  });

  it.each([
    '/docs/../package.json',
    '/docs/assets/../../package.json',
    '/docs/%2e%2e/package.json',
    '/docs/..%2fpackage.json',
    '/docs/..\\package.json',
    '/docs/index.html%00.png',
    '/docs//etc/passwd',
    '/docs/./index.html/..',
  ])('answers 404 under the docs headers to %s sent unnormalised', async (target) => {
    const dir = await builtDir();
    const server = await served(dir);
    await server.listen({ port: 0, host: '127.0.0.1' });
    const address = server.server.address();
    if (address === null || typeof address === 'string') throw new Error('not listening');
    const response = await new Promise<{
      status: number;
      headers: IncomingHttpHeaders;
      body: string;
    }>((resolve, reject) => {
      const request = httpRequest(
        { host: '127.0.0.1', port: address.port, path: target, method: 'GET' },
        (incoming) => {
          const chunks: Buffer[] = [];
          incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
          incoming.on('end', () => {
            resolve({
              status: incoming.statusCode ?? 0,
              headers: incoming.headers,
              body: Buffer.concat(chunks).toString('utf8'),
            });
          });
        },
      );
      request.on('error', reject);
      request.end();
    });
    expect([400, 404]).toContain(response.status);
    expect(response.body).not.toContain('"name"');
    expect(response.body).not.toContain('root:');
    if (response.status === 404) {
      expect(response.headers['x-robots-tag']).toBe('noindex, nofollow');
    }
  });

  it('does not follow a symlink out of the directory', async () => {
    const dir = await builtDir();
    const outside = await tmp();
    await put(outside, 'secret.html', 'outside the build');
    await symlink(join(outside, 'secret.html'), join(dir, 'link.html'));
    await symlink(outside, join(dir, 'linked'));
    const server = await served(dir);
    expect((await server.inject('/docs/link.html')).statusCode).toBe(404);
    expect((await server.inject('/docs/linked/secret.html')).statusCode).toBe(404);
  });

  it('answers HEAD with the headers of the GET and no body', async () => {
    const server = await served(await builtDir());
    const get = await server.inject('/docs/');
    const head = await server.inject({ method: 'HEAD', url: '/docs/' });
    expect(head.statusCode).toBe(200);
    expect(head.body).toBe('');
    expect(head.headers['content-security-policy']).toBe(POLICY);
    expect(head.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(head.headers['content-length']).toBe(get.headers['content-length']);
  });

  it('ignores a range request and sends the whole file', async () => {
    const server = await served(await builtDir());
    const response = await server.inject({
      url: '/docs/llms.txt',
      headers: { range: 'bytes=0-3' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('# Odudu');
    expect(response.headers['content-range']).toBeUndefined();
  });

  it('grants nothing to another origin and answers OPTIONS and writes with no docs', async () => {
    const server = await served(await builtDir());
    const options = await server.inject({
      method: 'OPTIONS',
      url: '/docs/',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' },
    });
    expect(options.statusCode).toBe(404);
    expect(options.headers['access-control-allow-origin']).toBeUndefined();
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH'] as const) {
      const response = await server.inject({ method, url: '/docs/' });
      expect(response.statusCode, method).toBe(404);
      expect(response.body).not.toContain('Documentation home');
    }
    const plain = await server.inject({
      url: '/docs/',
      headers: { origin: 'https://evil.example' },
    });
    expect(plain.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('registers nothing outside /docs', async () => {
    const server = await served(await builtDir());
    for (const url of ['/', '/index.html', '/documentation/', '/tenants/docs/x']) {
      expect((await server.inject(url)).statusCode, url).toBe(404);
    }
  });
});

describe('docsRoutes when the build cannot be served', () => {
  async function unavailable(
    dir: string,
  ): Promise<{ response: Awaited<ReturnType<FastifyInstance['inject']>>; logs: string }> {
    const logs: string[] = [];
    const server = await served(dir, logs);
    return { response: await server.inject('/docs/'), logs: logs.join('') };
  }

  it('answers 503 and names the variable and the switch when the directory is missing', async () => {
    const dir = join(await tmp(), 'absent');
    const { response, logs } = await unavailable(dir);
    expect(response.statusCode).toBe(503);
    expect(response.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBe("default-src 'none'");
    expect(logs).toContain('ODUDU_DOCS_DIR');
    expect(logs).toContain('ODUDU_DOCS=false');
    expect(logs).toContain(dir);
  });

  it('answers 503 when csp.json is missing', async () => {
    const dir = await builtDir();
    await rm(join(dir, 'csp.json'));
    const { response, logs } = await unavailable(dir);
    expect(response.statusCode).toBe(503);
    expect(logs).toContain('csp.json');
    expect(logs).toContain('ODUDU_DOCS_DIR');
  });

  it.each([
    ['not JSON', '{'],
    ['not an object', '[]'],
    [
      'hashes of the wrong shape',
      JSON.stringify({ scriptHashes: ['x'], styleAttributeHashes: [] }),
    ],
    [
      'a hash that would close the source list',
      JSON.stringify({ scriptHashes: [`sha256-${'A'.repeat(43)}='`], styleAttributeHashes: [] }),
    ],
  ])('answers 503 when csp.json is %s', async (_why, text) => {
    const dir = await builtDir();
    await put(dir, 'csp.json', text);
    const { response, logs } = await unavailable(dir);
    expect(response.statusCode).toBe(503);
    expect(logs).toContain('csp.json');
  });

  it('answers 503 when the directory has no home page', async () => {
    const dir = await builtDir();
    await rm(join(dir, 'index.html'));
    const { response, logs } = await unavailable(dir);
    expect(response.statusCode).toBe(503);
    expect(logs).toContain('index.html');
  });

  it('answers 503 for a tree of 5,001 files, without throwing', async () => {
    const dir = await builtDir();
    await mkdir(join(dir, 'many'));
    await Promise.all(
      Array.from({ length: 5_000 }, (_, index) =>
        writeFile(join(dir, 'many', `${String(index)}.txt`), 'x'),
      ),
    );
    const { response, logs } = await unavailable(dir);
    expect(response.statusCode).toBe(503);
    expect(logs).toContain('ODUDU_DOCS_DIR');
    expect(logs).toContain('5000 files');
  });

  it('still redirects /docs, so a bare address does not look different from a built one', async () => {
    const dir = join(await tmp(), 'absent');
    const server = await served(dir);
    expect((await server.inject('/docs')).statusCode).toBe(308);
  });
});
