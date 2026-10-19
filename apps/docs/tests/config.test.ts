import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PAGES_BASE, SITE_ORIGIN } from '#docs/site.config.ts';
import {
  DOCS_ROOT,
  distDir,
  htmlFiles,
  load,
  routeOf,
  walk,
  type Target,
} from '#docs/tests/support/dist.ts';

const BASES: Record<Target, string> = { pages: PAGES_BASE, image: '/docs/' };

describe('the site address', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('is one origin and one base, the host project path for now', () => {
    expect(SITE_ORIGIN).toBe('https://wizzywit.github.io');
    expect(PAGES_BASE).toBe('/odudu/');
  });

  it('moves when the environment names another origin and base', async () => {
    vi.stubEnv('DOCS_SITE_ORIGIN', 'https://example.test');
    vi.stubEnv('DOCS_BASE', '/');
    vi.resetModules();
    const config = await import('#docs/site.config.ts');
    expect([config.SITE_ORIGIN, config.PAGES_BASE]).toEqual(['https://example.test', '/']);
  });
});

describe('the two builds', () => {
  for (const target of ['pages', 'image'] as const) {
    it(`serves every absolute path of the ${target} build under its own base`, () => {
      const dir = distDir(target);
      const base = BASES[target];
      const outside: string[] = [];
      for (const file of htmlFiles(dir)) {
        const $ = load(file);
        const route = routeOf(dir, file, base);
        for (const [selector, attribute] of [
          ['a[href]', 'href'],
          ['link[href]', 'href'],
          ['script[src]', 'src'],
          ['img[src]', 'src'],
        ] as const) {
          $(selector).each((_, element) => {
            const value = $(element).attr(attribute);
            if (
              value?.startsWith('/') === true &&
              !value.startsWith('//') &&
              !value.startsWith(base)
            ) {
              outside.push(`${route}: ${value}`);
            }
          });
        }
      }
      expect(outside).toEqual([]);
    });

    it(`has a search index and a search page in the ${target} build`, () => {
      const dir = distDir(target);
      expect(existsSync(path.join(dir, 'search-index.json'))).toBe(true);
      expect(existsSync(path.join(dir, 'search/index.html'))).toBe(true);
    });
  }

  it('says noindex on every page of the image build and on none of the Pages build', () => {
    const noindex = (target: Target): number =>
      htmlFiles(distDir(target)).filter(
        (file) => load(file)('meta[name="robots"][content="noindex"]').length === 1,
      ).length;
    expect(noindex('image')).toBe(htmlFiles(distDir('image')).length);
    const search = path.join(distDir('pages'), 'search/index.html');
    const pagesWithRobots = htmlFiles(distDir('pages')).filter(
      (file) => file !== search && load(file)('meta[name="robots"][content="noindex"]').length > 0,
    );
    expect(pagesWithRobots).toEqual([]);
  });

  it('gives the image its own plain home, not the landing', () => {
    const text = load(path.join(distDir('image'), 'index.html'))('main').text();
    expect(text).toContain('Documentation');
    expect(walk(distDir('image')).some((file) => readFileSync(file).includes('Landing home'))).toBe(
      false,
    );
  });
});

describe('the static server', () => {
  function start(dir: string, base: string): Promise<{ origin: string; stop: () => void }> {
    return new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [path.join(DOCS_ROOT, 'scripts/serve.mjs'), dir, '--base', base, '--port', '0'],
        { stdio: ['ignore', 'pipe', 'inherit'] },
      );
      child.once('error', reject);
      child.stdout.on('data', (chunk: Buffer) => {
        const match = /Serving (http:\/\/127\.0\.0\.1:\d+)/u.exec(chunk.toString());
        if (match?.[1] !== undefined) {
          resolve({ origin: match[1], stop: () => child.kill() });
        }
      });
    });
  }

  it('compresses text, answers under the base and refuses outside it', async () => {
    const server = await start(distDir('pages'), PAGES_BASE);
    try {
      const home = await fetch(`${server.origin}${PAGES_BASE}`, {
        headers: { 'accept-encoding': 'gzip' },
      });
      expect(home.status).toBe(200);
      expect(home.headers.get('content-encoding')).toBe('gzip');
      expect(home.headers.get('content-type')).toContain('text/html');
      expect((await fetch(`${server.origin}/`)).status).toBe(404);
      expect((await fetch(`${server.origin}${PAGES_BASE}nope/`)).status).toBe(404);
      expect((await fetch(`${server.origin}${PAGES_BASE}../package.json`)).status).toBe(404);
    } finally {
      server.stop();
    }
  });
});
