import Fastify, { type FastifyInstance } from 'fastify';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { instrumentRoutes } from '#/view/routes';

const FONT = 'ibm-plex-sans-latin-400-normal.0a1b2c3d.woff2';
const dirs: string[] = [];
let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function builtDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'instrument-'));
  dirs.push(dir);
  await mkdir(join(dir, 'fonts'));
  await writeFile(join(dir, 'instrument.css'), 'body{margin:0}');
  await writeFile(join(dir, 'fonts', FONT), 'woff2-bytes');
  await writeFile(join(dir, 'fonts', '.hidden.woff2'), 'x');
  await writeFile(join(dir, 'notes.txt'), 'not a served type');
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
  await instance.register(instrumentRoutes(dir));
  await instance.ready();
  app = instance;
  return instance;
}

describe('instrumentRoutes', () => {
  it('serves the stylesheet as text/css with a strong etag that revalidates', async () => {
    const server = await served(await builtDir());
    const response = await server.inject('/instrument/instrument.css');
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/css; charset=utf-8');
    expect(response.headers['cache-control']).toBe('no-cache');
    expect(response.headers.etag).toMatch(/^"[A-Za-z0-9_-]+"$/u);
    expect(response.body).toBe('body{margin:0}');
  });

  it('answers 304 when the etag still matches, and 200 when it does not', async () => {
    const server = await served(await builtDir());
    const first = await server.inject('/instrument/instrument.css');
    const etag = String(first.headers.etag);
    const same = await server.inject({
      url: '/instrument/instrument.css',
      headers: { 'if-none-match': etag },
    });
    expect(same.statusCode).toBe(304);
    expect(same.body).toBe('');
    expect(same.headers.etag).toBe(etag);
    const stale = await server.inject({
      url: '/instrument/instrument.css',
      headers: { 'if-none-match': '"other"' },
    });
    expect(stale.statusCode).toBe(200);
  });

  it('serves a hashed font as immutable', async () => {
    const server = await served(await builtDir());
    const response = await server.inject(`/instrument/fonts/${FONT}`);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('font/woff2');
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('refuses a path outside the manifest', async () => {
    const server = await served(await builtDir());
    for (const path of [
      '/instrument/../etc/passwd',
      '/instrument/%2e%2e/x',
      '/instrument/..%2f..%2fetc/passwd',
      '/instrument/notes.txt',
      '/instrument/fonts/.hidden.woff2',
      '/instrument/fonts/',
      '/instrument/',
      '/instrument/missing.css',
    ]) {
      const response = await server.inject(path);
      expect(response.statusCode, path).toBe(404);
    }
  });

  it('warns and answers 404 when the directory is missing, rather than throwing', async () => {
    const logs: string[] = [];
    const server = await served(join(tmpdir(), 'instrument-does-not-exist'), logs);
    expect(logs.join('')).toContain('ODUDU_INSTRUMENT_DIR');
    expect((await server.inject('/instrument/instrument.css')).statusCode).toBe(404);
  });
});
