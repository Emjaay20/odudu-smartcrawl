import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PAGES_BASE } from '#docs/site.config.ts';
import { DOCS_ROOT, distDir } from '#docs/tests/support/dist.ts';

// A fallback face is Arial scaled by `size-adjust` so that its text is as wide
// as Plex's. Method: measure all the landing's own Plex copy, by weight, in
// Plex and in Arial (which is Liberation Sans, with the same widths, on Linux),
// and compare the ratio with the CSS. Over this copy the ratio was 1.002 to
// 1.004 for 400 and 0.961 to 0.963 for 600 on macOS and Linux, hence 100.3% and 96.2%.

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

describe('the fallback widths', () => {
  it('match Plex over the landing copy within a third of a percent', async () => {
    if (browser === undefined) throw new Error('the browser did not launch');
    const page = await browser.newPage();
    await page.goto(`${origin}${PAGES_BASE}`);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    const ratios = await page.evaluate(() => {
      const copy: Record<number, string> = { 400: '', 600: '' };
      const main = document.querySelector('main');
      if (main === null) return {};
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const element = node.parentElement;
        if (element?.closest('svg') !== null) continue;
        const style = getComputedStyle(element);
        const text = (node.textContent ?? '').replace(/\s+/gu, ' ').trim();
        if (style.display === 'none' || text === '' || style.fontFamily.includes('Mono')) continue;
        const weight = Number(style.fontWeight) >= 600 ? 600 : 400;
        copy[weight] = `${copy[weight] ?? ''}${text} `;
      }
      const context = document.createElement('canvas').getContext('2d');
      const width = (weight: number, family: string, text: string): number => {
        if (context === null) return 1;
        context.font = `${String(weight)} 100px ${family}`;
        return context.measureText(text).width;
      };
      return Object.fromEntries(
        [400, 600].map((weight) => {
          const text = copy[weight] ?? '';
          return [weight, width(weight, '"IBM Plex Sans"', text) / width(weight, 'Arial', text)];
        }),
      );
    });
    expect(ratios['400'] ?? 0).toBeCloseTo(1.003, 2);
    expect(Math.abs((ratios['400'] ?? 0) - 1.003)).toBeLessThan(0.003);
    expect(Math.abs((ratios['600'] ?? 0) - 0.962)).toBeLessThan(0.003);
    await page.close();
  });
});
