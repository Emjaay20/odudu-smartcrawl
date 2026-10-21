import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Result } from 'axe-core';
import { chromium, type Browser } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { IMAGE_BASE, PAGES_BASE } from '#docs/site.config.ts';
import { DOCS_ROOT, distDir, type Target } from '#docs/tests/support/dist.ts';

const BASES: Record<Target, string> = { pages: PAGES_BASE, image: IMAGE_BASE };
const origins: Partial<Record<Target, string>> = {};
const servers: ChildProcess[] = [];
let browser: Browser | undefined;

function serve(target: Target): Promise<string> {
  const child = spawn(
    process.execPath,
    [
      path.join(DOCS_ROOT, 'scripts/serve.mjs'),
      distDir(target),
      '--base',
      BASES[target],
      '--port',
      '0',
    ],
    { stdio: ['ignore', 'pipe', 'inherit'] },
  );
  servers.push(child);
  return new Promise<string>((resolve, reject) => {
    child.once('exit', () => {
      reject(new Error('the docs server exited before it was serving'));
    });
    child.stdout.on('data', (chunk: Buffer) => {
      const match = /Serving (http:\/\/127\.0\.0\.1:\d+)/u.exec(chunk.toString());
      if (match?.[1] !== undefined) resolve(match[1]);
    });
  });
}

beforeAll(async () => {
  origins.pages = await serve('pages');
  origins.image = await serve('image');
  browser = await chromium.launch();
});

afterAll(async () => {
  for (const server of servers) server.kill();
  await browser?.close();
});

describe('the search page in a browser', () => {
  for (const target of ['pages', 'image'] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      for (const width of [1280, 390]) {
        it(`has one main landmark and no accessibility violation: ${target}, ${scheme}, ${String(width)} px`, async () => {
          if (browser === undefined) throw new Error('the browser did not launch');
          const context = await browser.newContext({
            colorScheme: scheme,
            viewport: { width, height: 800 },
          });
          const page = await context.newPage();
          await page.goto(`${origins[target] ?? ''}${BASES[target]}search/?q=token`);
          await page.locator('html[data-has-hydrated="true"]').waitFor();
          expect(await page.locator('main').count()).toBe(1);
          const results = await new AxeBuilder({ page }).analyze();
          expect(results.violations.map((violation: Result) => violation.id)).toEqual([]);
          await context.close();
        });
      }
    }
  }
});
