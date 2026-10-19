import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { chromium, type Browser } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PAGES_BASE } from '#docs/site.config.ts';
import { DOCS_ROOT, distDir, type Target } from '#docs/tests/support/dist.ts';

const BASES: Record<Target, string> = { pages: PAGES_BASE, image: '/docs/' };
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

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'phone', width: 390, height: 844 },
] as const;

describe('the footer in a browser', () => {
  for (const target of ['pages', 'image'] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      for (const route of ['', 'reference/']) {
        it(`has no accessibility violation: ${target}, ${scheme}, /${route}`, async () => {
          if (browser === undefined) throw new Error('the browser did not launch');
          const context = await browser.newContext({ colorScheme: scheme });
          const page = await context.newPage();
          await page.goto(`${origins[target] ?? ''}${BASES[target]}${route}`);
          const results = await new AxeBuilder({ page }).include('footer').analyze();
          expect(results.violations.map((violation) => violation.id)).toEqual([]);
          await context.close();
        });
      }
    }
  }

  for (const viewport of VIEWPORTS) {
    it(`lays out in ${viewport.name} without horizontal scroll, with targets of at least 24 px`, async () => {
      if (browser === undefined) throw new Error('the browser did not launch');
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await page.goto(`${origins.pages ?? ''}${PAGES_BASE}`);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      const heights = await page
        .locator('footer a')
        .evaluateAll((links) => links.map((link) => link.getBoundingClientRect().height));
      expect(heights).toHaveLength(5);
      for (const height of heights) expect(height).toBeGreaterThanOrEqual(24);
      const footer = await page.locator('footer').boundingBox();
      expect(footer?.height ?? 0).toBeLessThan(viewport.name === 'phone' ? 260 : 120);
      await context.close();
    });
  }

  it('sits on the surface of the page, under a hairline', async () => {
    if (browser === undefined) throw new Error('the browser did not launch');
    for (const scheme of ['light', 'dark'] as const) {
      const context = await browser.newContext({ colorScheme: scheme });
      const page = await context.newPage();
      await page.goto(`${origins.pages ?? ''}${PAGES_BASE}`);
      const colours = await page.evaluate(() => {
        const read = (selector: string) => {
          const element = document.querySelector(selector);
          return element === null ? '' : getComputedStyle(element).backgroundColor;
        };
        return { footer: read('footer.footer'), navbar: read('nav.navbar') };
      });
      expect(colours.footer).toBe(colours.navbar);
      const border = await page
        .locator('footer.footer')
        .evaluate((element) => getComputedStyle(element).borderTopWidth);
      expect(border).toBe('1px');
      await context.close();
    }
  });
});
