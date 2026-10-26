import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PAGES_BASE } from '#docs/site.config.ts';
import { DOCS_ROOT, distDir } from '#docs/tests/support/dist.ts';

let origin = '';
let server: ChildProcess | undefined;
let browser: Browser | undefined;

beforeAll(async () => {
  const child = spawn(
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
  server = child;
  origin = await new Promise<string>((resolve, reject) => {
    child.once('exit', () => {
      reject(new Error('the docs server exited before it was serving'));
    });
    child.stdout.on('data', (chunk: Buffer) => {
      const match = /Serving (http:\/\/127\.0\.0\.1:\d+)/u.exec(chunk.toString());
      if (match?.[1] !== undefined) resolve(match[1]);
    });
  });
  browser = await chromium.launch();
});

afterAll(async () => {
  server?.kill();
  await browser?.close();
});

const WIDTHS = [1440, 1024, 400] as const;
const BANDS = ['pages', 'branding', 'agents'] as const;
const TOLERANCE = 1.5;

async function open(width: number, theme: 'light' | 'dark'): Promise<Page> {
  if (browser === undefined) throw new Error('the browser did not launch');
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    colorScheme: theme,
  });
  const page = await context.newPage();
  await page.addInitScript((value) => {
    localStorage.setItem('theme', value);
  }, theme);
  await page.goto(`${origin}${PAGES_BASE}`);
  await page.evaluate(() => {
    for (const image of document.querySelectorAll('img[loading="lazy"]')) {
      image.setAttribute('loading', 'eager');
    }
  });
  return page;
}

describe.each(WIDTHS)('the landing page at %i px', (width) => {
  it.each(['light', 'dark'] as const)(
    'has no horizontal scroll, and frames of one height in a row, in %s',
    async (theme) => {
      const page = await open(width, theme);
      try {
        const { overflow, rows } = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          rows: [...document.querySelectorAll('[data-row]')].map((row) => ({
            kind: row.getAttribute('data-row'),
            heights: [...row.querySelectorAll('[data-frame]')].map(
              (frame) => frame.getBoundingClientRect().height,
            ),
            widths: [...row.querySelectorAll('[data-frame]')].map(
              (frame) => frame.getBoundingClientRect().width,
            ),
          })),
        }));
        expect(overflow).toBeLessThanOrEqual(0);
        expect(rows.map((row) => row.kind)).toEqual(['large', 'small']);
        for (const row of rows) {
          expect(row.heights).toHaveLength(2);
          expect(Math.abs((row.heights[0] ?? 0) - (row.heights[1] ?? 1))).toBeLessThan(TOLERANCE);
          expect(Math.abs((row.widths[0] ?? 0) - (row.widths[1] ?? 1))).toBeLessThan(TOLERANCE);
        }
      } finally {
        await page.context().close();
      }
    },
  );

  it.each(BANDS)('has its %s band spanning the container, with no empty side', async (band) => {
    const page = await open(width, 'dark');
    try {
      const box = await page.evaluate((name) => {
        const section = document.querySelector(`[data-section="${name}"]`);
        const wrap = section?.firstElementChild;
        if (!wrap) throw new Error(`no ${name} band`);
        const style = getComputedStyle(wrap);
        const outer = wrap.getBoundingClientRect();
        let left = Infinity;
        let right = 0;
        for (const element of wrap.querySelectorAll('*')) {
          const rect = element.getBoundingClientRect();
          const shown = getComputedStyle(element);
          if (rect.width === 0 || rect.height === 0 || shown.display === 'none') continue;
          left = Math.min(left, rect.left);
          right = Math.max(right, rect.right);
        }
        return {
          containerLeft: outer.left + parseFloat(style.paddingLeft),
          containerRight: outer.right - parseFloat(style.paddingRight),
          left,
          right,
        };
      }, band);
      expect(Math.abs(box.left - box.containerLeft)).toBeLessThan(TOLERANCE);
      expect(Math.abs(box.right - box.containerRight)).toBeLessThan(TOLERANCE);
    } finally {
      await page.context().close();
    }
  });
});
