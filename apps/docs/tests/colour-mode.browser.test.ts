import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PAGES_BASE } from '#docs/site.config.ts';
import { DOCS_ROOT, distDir } from '#docs/tests/support/dist.ts';

let server: ChildProcess | undefined;
let browser: Browser | undefined;
let origin = '';

beforeAll(async () => {
  server = spawn(
    process.execPath,
    [
      path.join(DOCS_ROOT, 'scripts/serve.mjs'),
      distDir('pages'),
      '--base',
      PAGES_BASE,
      '--port',
      '0',
    ],
    { stdio: ['ignore', 'pipe', 'inherit'] },
  );
  const serving = server;
  origin = await new Promise<string>((resolve, reject) => {
    serving.once('exit', () => {
      reject(new Error('the docs server exited before it was serving'));
    });
    serving.stdout?.on('data', (chunk: Buffer) => {
      const match = /Serving (http:\/\/127\.0\.0\.1:\d+)/u.exec(chunk.toString());
      if (match?.[1] !== undefined) resolve(match[1]);
    });
  });
  browser = await chromium.launch();
});

// The server is killed first and whatever else fails, because a child left
// running holds the test worker open and the run hangs instead of failing.
afterAll(async () => {
  server?.kill();
  await browser?.close();
});

describe('the colour mode', () => {
  for (const system of ['light', 'dark'] as const) {
    it(`starts in the system's ${system} and follows the toggle`, async () => {
      if (browser === undefined) throw new Error('the browser did not launch');
      const context = await browser.newContext({ colorScheme: system });
      const page = await context.newPage();
      await page.goto(`${origin}${PAGES_BASE}`);
      const theme = () => page.locator('html').getAttribute('data-theme');
      const navbar = () =>
        page.locator('nav.navbar').evaluate((element) => getComputedStyle(element).backgroundColor);
      // Instrument's panel surface as the current colour mode resolves it.
      const panel = () =>
        page.evaluate(() => {
          const probe = document.createElement('div');
          probe.style.backgroundColor = 'var(--surface-panel)';
          document.body.append(probe);
          const colour = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return colour;
        });

      expect(await theme()).toBe(system);
      expect(await navbar()).toBe(await panel());

      const toggle = page.locator('button[class*="toggleButton"]').first();
      const seen: string[] = [];
      for (let click = 0; click < 3; click += 1) {
        await toggle.click();
        const now = await theme();
        seen.push(now ?? '');
        expect(await navbar()).toBe(await panel());
      }
      expect(new Set(seen)).toEqual(new Set(['light', 'dark']));
      await context.close();
    });
  }
});
