import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Result } from 'axe-core';
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

const address = (target: Target): string => `${origins[target] ?? ''}${BASES[target]}quick-start/`;

describe('the quick start in a browser', () => {
  for (const target of ['pages', 'image'] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      it(`has no accessibility violation, with either tab showing: ${target}, ${scheme}`, async () => {
        if (browser === undefined) throw new Error('the browser did not launch');
        const context = await browser.newContext({ colorScheme: scheme });
        const page = await context.newPage();
        const problems: string[] = [];
        page.on('console', (message) => {
          if (message.type() === 'error') problems.push(message.text());
        });
        await page.goto(address(target));
        for (const tab of ['Console', 'Command line']) {
          await page.getByRole('tab', { name: tab }).first().click();
          const results = await new AxeBuilder({ page }).include('article').analyze();
          expect(results.violations.map((violation: Result) => violation.id)).toEqual([]);
        }
        expect(problems).toEqual([]);
        await context.close();
      });
    }
  }

  it('switches every step together, and shows the command line tab with its commands', async () => {
    if (browser === undefined) throw new Error('the browser did not launch');
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(address('pages'));
    const panels = page.getByRole('tabpanel');
    await page.getByRole('tab', { name: 'Command line' }).first().click();
    const visible = await panels.evaluateAll(
      (nodes) => nodes.filter((node) => (node as HTMLElement).offsetParent !== null).length,
    );
    expect(visible).toBeGreaterThanOrEqual(4);
    expect(await page.getByText('odudu seed tenant --name demo').first().isVisible()).toBe(true);
    await context.close();
  });

  it('shows the capture that matches the theme, sized and lazily loaded', async () => {
    if (browser === undefined) throw new Error('the browser did not launch');
    for (const scheme of ['light', 'dark'] as const) {
      const context = await browser.newContext({ colorScheme: scheme });
      const page = await context.newPage();
      await page.goto(address('pages'));
      const shots = await page.locator('figure img').evaluateAll((images) =>
        images.map((image) => {
          const element = image as HTMLImageElement;
          return {
            src: element.getAttribute('src') ?? '',
            shown: getComputedStyle(element).display !== 'none',
            sized: element.hasAttribute('width') && element.hasAttribute('height'),
            lazy: element.getAttribute('loading') === 'lazy',
            alt: element.alt,
          };
        }),
      );
      expect(shots.length).toBeGreaterThan(10);
      for (const shot of shots) {
        expect(shot.sized, shot.src).toBe(true);
        expect(shot.lazy, shot.src).toBe(true);
        expect(shot.alt.length, shot.src).toBeGreaterThan(20);
        expect(shot.shown, shot.src).toBe(shot.src.includes(`-${scheme}.webp`));
      }
      await context.close();
    }
  });
});
