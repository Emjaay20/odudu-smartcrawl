import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DOCS_ROOT } from '#docs/tests/support/dist.ts';

// The preview server stands in for GitHub Pages, so it is held to what Pages
// does: a directory without its slash is redirected, a miss under the base is
// the build's own 404 page, and nothing outside the base is served.
const BASE = '/site/';
let dist: string;
let child: ChildProcess;
let origin: string;

function start(root: string): Promise<{ child: ChildProcess; origin: string }> {
  const server = spawn(
    process.execPath,
    [path.join(DOCS_ROOT, 'scripts/serve.mjs'), root, '--base', BASE, '--port', '0'],
    { stdio: ['ignore', 'pipe', 'inherit'] },
  );
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.stdout.on('data', (chunk: Buffer) => {
      const match = /Serving (http:\/\/127\.0\.0\.1:\d+)/u.exec(chunk.toString());
      if (match?.[1] !== undefined) resolve({ child: server, origin: match[1] });
    });
  });
}

beforeAll(async () => {
  dist = mkdtempSync(path.join(tmpdir(), 'docs-serve-'));
  mkdirSync(path.join(dist, 'guides'));
  writeFileSync(path.join(dist, 'index.html'), '<h1>home</h1>');
  writeFileSync(path.join(dist, 'guides', 'index.html'), '<h1>guides</h1>');
  writeFileSync(path.join(dist, '404.html'), '<h1>the build 404</h1>');
  writeFileSync(path.join(dist, 'secret.txt'), 'outside');
  ({ child, origin } = await start(path.join(dist, '.')));
});

afterAll(() => {
  child.kill();
  rmSync(dist, { recursive: true, force: true });
});

const get = (url: string, init?: RequestInit): Promise<Response> =>
  fetch(`${origin}${url}`, { redirect: 'manual', ...init });

describe('the preview server', () => {
  it('serves a directory index and a file under the base', async () => {
    expect(await (await get(`${BASE}guides/`)).text()).toBe('<h1>guides</h1>');
    expect(await (await get(BASE)).text()).toBe('<h1>home</h1>');
  });

  it('redirects a directory without its slash, query kept', async () => {
    for (const [from, to] of [
      [`${BASE}guides`, `${BASE}guides/`],
      [`${BASE}guides?x=1`, `${BASE}guides/?x=1`],
      [BASE.slice(0, -1), BASE],
    ]) {
      const res = await get(from ?? '');
      expect(res.status, from).toBe(308);
      expect(res.headers.get('location'), from).toBe(to);
    }
  });

  it('answers a miss under the base with the build 404 page and status 404', async () => {
    for (const url of [
      `${BASE}nope/`,
      `${BASE}nope`,
      `${BASE}guides/nope.md`,
      `${BASE}docs-typo`,
    ]) {
      const res = await get(url);
      expect(res.status, url).toBe(404);
      expect(res.headers.get('content-type')).toContain('text/html');
      expect(await res.text(), url).toBe('<h1>the build 404</h1>');
    }
  });

  it('answers a path outside the base with plain text, not the site page', async () => {
    const res = await get('/elsewhere/');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('text/plain');
    expect(await res.text()).toBe('Not found');
  });

  it('answers HEAD with the same status and headers and no body', async () => {
    const res = await get(`${BASE}nope/`, { method: 'HEAD' });
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toBe('');
    expect((await get(`${BASE}guides`, { method: 'HEAD' })).status).toBe(308);
  });

  it('never leaves the build directory, however the path is written', async () => {
    for (const url of [
      `${BASE}../secret.txt`,
      `${BASE}..%2fsecret.txt`,
      `${BASE}%2e%2e/secret.txt`,
      `${BASE}%E0%A4%A`,
    ]) {
      const res = await get(url);
      expect(res.status, url).toBe(404);
      expect(await res.text(), url).not.toBe('outside');
    }
  });

  it('falls back to plain text when the build has no 404 page', async () => {
    const bare = mkdtempSync(path.join(tmpdir(), 'docs-serve-bare-'));
    writeFileSync(path.join(bare, 'index.html'), 'x');
    const other = await start(bare);
    try {
      const res = await fetch(`${other.origin}${BASE}nope/`);
      expect(res.status).toBe(404);
      expect(await res.text()).toBe('Not found');
    } finally {
      other.child.kill();
      rmSync(bare, { recursive: true, force: true });
    }
  });

  it('compresses text for a client that accepts gzip', async () => {
    const res = await get(BASE, { headers: { 'accept-encoding': 'gzip' } });
    expect(res.headers.get('content-encoding')).toBe('gzip');
  });
});
