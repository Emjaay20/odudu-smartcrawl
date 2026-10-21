import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Result } from 'axe-core';
import { chromium, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JOURNEYS, SECTIONS } from '#docs/nav.ts';
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

const home = (): string => `${origin}${PAGES_BASE}`;

async function visit(
  options: BrowserContextOptions = {},
  prepare?: (page: Page) => Promise<void>,
): Promise<{ page: Page; close: () => Promise<void> }> {
  if (browser === undefined) throw new Error('the browser did not launch');
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await prepare?.(page);
  await page.goto(home());
  return { page, close: () => context.close() };
}

const WINDOWS_LABEL = 'PowerShell';

describe('the landing page in a browser', () => {
  it('shows what it is, the one command and the docs link above the fold at 390 x 844', async () => {
    const { page, close } = await visit({ viewport: { width: 390, height: 844 } });
    const heading = await page.locator('h1').boundingBox();
    const command = await page.locator('code[data-shell]:visible').first().boundingBox();
    const docs = await page.getByRole('link', { name: 'Read the docs' }).boundingBox();
    expect(heading?.y ?? -1).toBeGreaterThanOrEqual(0);
    for (const box of [heading, command, docs]) {
      expect(box).not.toBeNull();
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(844);
    }
    await close();
  });

  for (const width of [320, 390, 768, 1280]) {
    it(`has no horizontal scroll at ${String(width)} px`, async () => {
      const { page, close } = await visit({ viewport: { width, height: 900 } });
      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(overflow.scroll).toBeLessThanOrEqual(overflow.inner);
      await close();
    });
  }

  it('copies the command that is showing, as one ASCII line', async () => {
    const { page, close } = await visit({ permissions: ['clipboard-read', 'clipboard-write'] });
    for (const choose of [undefined, WINDOWS_LABEL]) {
      if (choose !== undefined) await page.getByText(choose, { exact: true }).click();
      await page.getByRole('button', { name: /^Copy/u }).click();
      await page.getByRole('button', { name: /^Copied/u }).waitFor();
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      const shown = await page.locator('code[data-shell]:visible').innerText();
      expect(copied).toBe(shown);
      expect(copied).toMatch(/^[\x20-\x7e]+$/u);
      expect(copied).not.toContain('\n');
    }
    await close();
  });

  it('opens each reader path in one click', async () => {
    const { page, close } = await visit();
    const links = page.locator('[data-section="readers"] a');
    expect(await links.count()).toBe(4);
    const targets = await links.evaluateAll((anchors) =>
      anchors.map((anchor) => anchor.getAttribute('href') ?? ''),
    );
    for (const target of targets) {
      await page.goto(home());
      await page.locator(`[data-section="readers"] a[href="${target}"]`).click();
      await page.waitForURL(`${origin}${target}`);
      expect(await page.locator('h1').count()).toBeGreaterThan(0);
    }
    await close();
  });

  it('answers every link of the capabilities and the examples with a page', async () => {
    const { page, close } = await visit();
    const hrefs = await page
      .locator('[data-section="capabilities"] a, [data-section="examples"] a[href^="/"]')
      .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href') ?? ''));
    expect(hrefs.length).toBeGreaterThanOrEqual(6);
    for (const href of hrefs) {
      const response = await page.request.get(`${origin}${href}`);
      expect(response.status(), href).toBe(200);
    }
    await close();
  });

  it('has no motion under prefers-reduced-motion: reduce', async () => {
    const { page, close } = await visit({ reducedMotion: 'reduce' });
    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    const moving = await page.evaluate(() => {
      const zero = (value: string): boolean =>
        value.split(',').every((part) => part.trim() === '0s');
      return [...document.querySelectorAll('[data-page="landing"], [data-page="landing"] *')]
        .filter((element) => {
          const style = getComputedStyle(element);
          return style.animationName !== 'none' || !zero(style.transitionDuration);
        })
        .map((element) => element.getAttribute('class') ?? element.tagName);
    });
    expect(moving).toEqual([]);
    await close();
  });

  it('reveals sections with a scroll timeline, and the hero text and picture never wait on one', async () => {
    const { page, close } = await visit({ reducedMotion: 'no-preference' });
    await page.locator('[data-motion="ok"]').waitFor({ state: 'attached' });
    const timelines = await page.evaluate(
      () =>
        [...document.querySelectorAll('[data-reveal]')].filter((element) =>
          getComputedStyle(element).animationTimeline.includes('view'),
        ).length,
    );
    expect(timelines).toBeGreaterThan(10);
    const waiting = await page.evaluate(() => {
      const first = [
        document.querySelector('h1'),
        document.querySelector('[data-page="landing"] header p'),
        document.querySelector('[data-page="landing"] header img'),
      ];
      return first.flatMap((element) =>
        element === null
          ? ['missing']
          : element.getAnimations({ subtree: false }).map(() => element.tagName),
      );
    });
    expect(waiting).toEqual([]);
    const painted = await page.evaluate(() => {
      const hero = document.querySelector('[data-page="landing"] header');
      return [...(hero?.querySelectorAll('h1, p, img, code') ?? [])].filter(
        (element) => getComputedStyle(element).opacity !== '1',
      ).length;
    });
    expect(painted).toBe(0);
    await close();
  });

  it('plays nothing and shows everything under reduced motion', async () => {
    const { page, close } = await visit({ reducedMotion: 'reduce' });
    await page.waitForTimeout(300);
    const state = await page.evaluate(() => {
      const items = [...document.querySelectorAll('[data-page="landing"] *')].filter(
        (element) => element instanceof HTMLElement,
      );
      return {
        motionClass: document.querySelector('[data-motion]') !== null,
        running: document.getAnimations().length,
        hidden: items.filter((element) => getComputedStyle(element).opacity !== '1').length,
        moved: items.filter((element) => getComputedStyle(element).transform !== 'none').length,
        replay: document.querySelector('button[hidden]') !== null,
      };
    });
    expect(state).toEqual({ motionClass: false, running: 0, hidden: 0, moved: 0, replay: true });
    await close();
  });

  it('shows every section and every step with JavaScript disabled', async () => {
    const { page, close } = await visit({ javaScriptEnabled: false });
    const state = await page.evaluate(() => {
      const items = [...document.querySelectorAll('[data-reveal], ol[data-flow] > li')];
      return {
        count: items.length,
        hidden: items.filter((element) => {
          const style = getComputedStyle(element);
          return style.opacity !== '1' || style.visibility !== 'visible';
        }).length,
      };
    });
    expect(state.count).toBeGreaterThan(20);
    expect(state.hidden).toBe(0);
    await close();
  });

  it('reveals with an observer where scroll timelines are missing, and never hides the page if it cannot', async () => {
    const withoutTimelines = async (target: Page): Promise<void> => {
      await target.addInitScript(() => {
        const supports = CSS.supports.bind(CSS);
        CSS.supports = (property: string, value?: string): boolean =>
          property.startsWith('animation-timeline') ? false : supports(property, value ?? '');
      });
      await target.route('**/*.css', async (route) => {
        const response = await route.fetch();
        const body = (await response.text()).replaceAll('animation-timeline', 'animation-timelinx');
        await route.fulfill({ response, body });
      });
    };
    const { page, close } = await visit(
      { viewport: { width: 1280, height: 800 } },
      withoutTimelines,
    );
    await page.locator('[data-motion="ok"]').waitFor({ state: 'attached' });
    await page.waitForTimeout(800);
    const hiddenAtFirst = await page.evaluate(
      () =>
        [...document.querySelectorAll('[data-reveal]')].filter(
          (element) => getComputedStyle(element).opacity === '0',
        ).length,
    );
    expect(hiddenAtFirst).toBeGreaterThan(10);
    await page.evaluate(async () => {
      for (let y = 0; y <= document.documentElement.scrollHeight; y += 300) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    });
    await page.waitForTimeout(800);
    const stillHidden = await page.evaluate(
      () =>
        [...document.querySelectorAll('[data-reveal]')].filter(
          (element) => getComputedStyle(element).opacity !== '1',
        ).length,
    );
    expect(stillHidden).toBe(0);
    await close();

    const bare = await visit({}, async (target) => {
      await withoutTimelines(target);
      await target.addInitScript(() => {
        Reflect.deleteProperty(window, 'IntersectionObserver');
      });
    });
    await bare.page.waitForTimeout(500);
    const state = await bare.page.evaluate(() => ({
      armed: document.querySelector('[data-motion]') !== null,
      hidden: [...document.querySelectorAll('[data-reveal]')].filter(
        (element) => getComputedStyle(element).opacity !== '1',
      ).length,
    }));
    expect(state).toEqual({ armed: false, hidden: 0 });
    await bare.close();
  });

  it('shifts nothing while loading and scrolling', async () => {
    if (browser === undefined) throw new Error('the browser did not launch');
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const holder = window as unknown as { shift: number };
      holder.shift = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const record = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (!record.hadRecentInput) holder.shift += record.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(home());
    await page.waitForLoadState('networkidle');
    await page.evaluate(async () => {
      for (let y = 0; y <= document.documentElement.scrollHeight; y += 250) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
    });
    await page.waitForTimeout(500);
    const shift = await page.evaluate(() => (window as unknown as { shift: number }).shift);
    expect(shift).toBeLessThan(0.001);
    await context.close();
  });

  it('plays the sign-in pictures once in view, rests on all steps, and plays again on request', async () => {
    const { page, close } = await visit({ viewport: { width: 1280, height: 800 } });
    const steps = page.locator('ol[data-flow] > li');
    expect(await steps.count()).toBe(9);
    await page.locator('[data-section="signin"]').scrollIntoViewIfNeeded();
    await page.locator('[data-flow="first"][data-playing]').waitFor();
    await page.waitForTimeout(4200);
    const resting = await page.evaluate(() =>
      [...document.querySelectorAll('[data-flow="first"] > li')].map(
        (element) => getComputedStyle(element).opacity,
      ),
    );
    expect(resting).toEqual(['1', '1', '1', '1']);
    await page.getByRole('button', { name: 'Replay' }).focus();
    await page.keyboard.press('Enter');
    await page.locator('[data-flow="first"][data-playing]').waitFor();
    const restarted = await page.evaluate(() =>
      document.getAnimations().some((animation) => animation.playState === 'running'),
    );
    expect(restarted).toBe(true);
    await close();
  });

  for (const width of [375, 320]) {
    it(`stacks the sign-in steps and keeps their text readable at ${String(width)} px`, async () => {
      const { page, close } = await visit({ viewport: { width, height: 800 } });
      const layout = await page.evaluate(() => {
        const steps = [...document.querySelectorAll('[data-flow="first"] > li')];
        const lefts = new Set(steps.map((step) => Math.round(step.getBoundingClientRect().left)));
        const smallest = Math.min(
          ...[...document.querySelectorAll('[data-flow] li p, [data-flow] li li')].map((text) =>
            Number.parseFloat(getComputedStyle(text).fontSize),
          ),
        );
        return { columns: lefts.size, smallest };
      });
      expect(layout.columns).toBe(1);
      expect(layout.smallest).toBeGreaterThanOrEqual(12);
      await close();
    });
  }

  it('shows the sign-in steps with their text alternatives under reduced motion', async () => {
    const { page, close } = await visit({ reducedMotion: 'reduce' });
    const pictures = await page
      .locator('[data-flow] svg[role="img"]')
      .evaluateAll((svgs) => svgs.map((svg) => svg.getAttribute('aria-label') ?? ''));
    expect(pictures).toHaveLength(9);
    for (const label of pictures) expect(label.length).toBeGreaterThan(15);
    expect(
      await page
        .locator('[data-flow] li')
        .evaluateAll((items) => items.every((item) => getComputedStyle(item).opacity === '1')),
    ).toBe(true);
    await close();
  });

  for (const scheme of ['light', 'dark'] as const) {
    for (const motion of ['no-preference', 'reduce'] as const) {
      for (const route of ['', 'introduction/']) {
        for (const scrolled of route === '' ? [false, true] : [false]) {
          it(`passes axe: ${scheme}, motion ${motion}, /${route}${scrolled ? ', scrolled' : ''}`, async () => {
            const { page, close } = await visit({ colorScheme: scheme, reducedMotion: motion });
            if (route !== '') await page.goto(`${home()}${route}`);
            await page.evaluate(async () => {
              await document.fonts.ready;
            });
            if (scrolled) {
              await page.evaluate(async () => {
                for (let y = 0; y <= document.documentElement.scrollHeight; y += 300) {
                  window.scrollTo(0, y);
                  await new Promise((resolve) => setTimeout(resolve, 50));
                }
                window.scrollTo(0, 0);
              });
              await page.waitForTimeout(5000);
            }
            const results = await new AxeBuilder({ page })
              .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
              .analyze();
            expect(
              results.violations.map(
                (violation: Result) =>
                  `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`,
              ),
            ).toEqual([]);
            await close();
          });
        }
      }
    }
  }

  it('shows the headline, the one command and every section link with JavaScript disabled', async () => {
    const { page, close } = await visit({ javaScriptEnabled: false });
    expect(await page.locator('h1').isVisible()).toBe(true);
    expect(await page.locator('code[data-shell]:visible').count()).toBe(1);
    expect(await page.locator('code[data-shell="unix"]').isVisible()).toBe(true);
    for (const route of [...SECTIONS.map((s) => s.route), ...JOURNEYS.map((j) => j.route)]) {
      const link = page.locator(`main a[href="${PAGES_BASE}${route}"]`).first();
      expect(await link.isVisible(), route).toBe(true);
    }
    await page.getByText(WINDOWS_LABEL, { exact: true }).click();
    expect(await page.locator('code[data-shell="windows"]').isVisible()).toBe(true);
    expect(await page.locator('code[data-shell="unix"]').isVisible()).toBe(false);
    await close();
  });

  it('loads no script, font or other file from another origin', async () => {
    const hosts = new Set<string>();
    const { page, close } = await visit({}, (target) => {
      target.on('request', (request) => {
        const url = new URL(request.url());
        if (url.protocol.startsWith('http')) hosts.add(url.host);
      });
      return Promise.resolve();
    });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    expect([...hosts]).toEqual([new URL(origin).host]);
    await close();
  });

  it('keeps first-load JavaScript under 200 KB gzip', async () => {
    const { page, close } = await visit({}, async (target) => {
      const client = await target.context().newCDPSession(target);
      await client.send('Network.enable');
      const scripts = new Set<string>();
      let bytes = 0;
      client.on('Network.responseReceived', (event) => {
        if (event.type === 'Script') scripts.add(event.requestId);
      });
      client.on('Network.loadingFinished', (event) => {
        if (scripts.has(event.requestId)) bytes += event.encodedDataLength;
      });
      await target.exposeFunction('scriptBytes', () => bytes);
    });
    await page.waitForLoadState('networkidle');
    const bytes = await page.evaluate(() =>
      (window as unknown as { scriptBytes(): Promise<number> }).scriptBytes(),
    );
    expect(bytes).toBeGreaterThan(50_000);
    expect(bytes).toBeLessThan(200 * 1024);
    await close();
  });

  it('shifts nothing when the fonts arrive late', async () => {
    if (browser === undefined) throw new Error('the browser did not launch');
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.route('**/*.woff2', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });
    await page.addInitScript(() => {
      const holder = window as unknown as { shift: number };
      holder.shift = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const record = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (!record.hadRecentInput) holder.shift += record.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(home());
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.waitForTimeout(500);
    const shift = await page.evaluate(() => (window as unknown as { shift: number }).shift);
    expect(shift).toBeLessThan(0.02);
    await context.close();
  });
});
