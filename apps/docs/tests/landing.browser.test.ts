import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Result } from 'axe-core';
import { chromium, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JOURNEYS, SECTIONS } from '#docs/nav.ts';
import { BEATS } from '#docs/src/components/Landing/geometry.ts';
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
  // Automation says so through navigator.webdriver and the page then skips its
  // reveal; the tests want the page a visitor gets.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
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
    const links = page.locator(
      '[data-section="readers"] li:not([data-section="examples"] li) h3 a',
    );
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
      };
    });
    expect(state).toEqual({ motionClass: false, running: 0, hidden: 0, moved: 0 });
    await close();
  });

  it('shows every section and every step with JavaScript disabled', async () => {
    const { page, close } = await visit({ javaScriptEnabled: false });
    const state = await page.evaluate(() => {
      const items = [...document.querySelectorAll('[data-reveal], [data-flow-captions] > li')];
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

  for (const [name, prepare] of [
    ['with scroll timelines', undefined],
    ['with the observer fallback', withoutTimelines],
  ] as const) {
    it(`never leaves the page blank before, during or after scrolling, ${name}`, async () => {
      const { page, close } = await visit({ viewport: { width: 1280, height: 800 } }, prepare);
      await page.locator('[data-motion="ok"]').waitFor({ state: 'attached' });
      await page.waitForTimeout(900);
      const settle = (): Promise<{ least: number; offset: number; count: number }> =>
        page.evaluate(() => {
          const items = [
            ...document.querySelectorAll('[data-reveal], [data-flow-captions] > li'),
          ].map((item) => {
            const style = getComputedStyle(item);
            return {
              opacity: Number(style.opacity),
              moved: !['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(style.transform),
            };
          });
          return {
            count: items.length,
            least: Math.min(...items.map((item) => item.opacity)),
            offset: items.filter((item) => item.moved).length,
          };
        });
      const first = await settle();
      expect(first.count).toBeGreaterThan(20);
      expect(first.least).toBeGreaterThanOrEqual(0.85);
      expect(first.offset).toBeGreaterThan(5);
      const capture = await page.screenshot({ fullPage: true });
      expect(capture.byteLength).toBeGreaterThan(50_000);
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(axe.violations.map((violation: Result) => violation.id)).toEqual([]);
      await page.evaluate(async () => {
        for (let y = 0; y <= document.documentElement.scrollHeight; y += 250) {
          window.scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 60));
        }
      });
      await page.waitForTimeout(4500);
      const last = await settle();
      expect(last.least).toBe(1);
      expect(last.offset).toBe(0);
      await close();
    });
  }

  it('does not reveal for automation, and does nothing without an observer', async () => {
    if (browser === undefined) throw new Error('the browser did not launch');
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(home());
    await page.waitForTimeout(500);
    expect(await page.locator('[data-pending]').count()).toBe(0);
    await context.close();
    const bare = await visit({}, async (target) => {
      await withoutTimelines(target);
      await target.addInitScript(() => {
        Reflect.deleteProperty(window, 'IntersectionObserver');
      });
    });
    await bare.page.waitForTimeout(500);
    expect(await bare.page.locator('[data-pending]').count()).toBe(0);
    expect(await bare.page.locator('[data-motion]').count()).toBe(0);
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

  it('plays the sign-in scene one step after another, then rests', async () => {
    const { page, close } = await visit(
      { viewport: { width: 1280, height: 800 } },
      async (target) => {
        await target.clock.install();
      },
    );
    await page.locator('[data-flow]').waitFor();
    await page.evaluate(() => {
      document.querySelector('[data-flow]')?.scrollIntoView({ block: 'center' });
    });
    const seen: string[] = [];
    await page.locator('[data-flow][data-step="1"]').waitFor();
    for (const beat of BEATS) {
      seen.push((await page.locator('[data-flow]').getAttribute('data-step')) ?? '');
      await page.clock.runFor(beat.ms);
    }
    seen.push((await page.locator('[data-flow]').getAttribute('data-step')) ?? '');
    expect(seen).toEqual(['1', '2', '3', '4', '5', '6', '7', '0']);
    await close();
  });

  it('lets a step be chosen from the keyboard, pauses there and plays again on request', async () => {
    const { page, close } = await visit({ viewport: { width: 1280, height: 800 } });
    await page.locator('[data-flow] [role="group"]').waitFor();
    const third = page.getByRole('button', { name: /Sign in once/u });
    await third.focus();
    await page.keyboard.press('Enter');
    expect(await third.getAttribute('aria-current')).toBe('step');
    expect(await page.locator('[data-flow]').getAttribute('data-step')).toBe('3');
    expect(await page.locator('[data-flow] [role="status"]').innerText()).toContain(
      'Step 3 of 7: They sign in on Odudu',
    );
    await page.waitForTimeout(1200);
    expect(await page.locator('[data-flow]').getAttribute('data-step')).toBe('3');
    expect(await page.locator('[aria-current="step"]').count()).toBe(1);
    await page.getByRole('button', { name: 'Replay' }).click();
    expect(await page.locator('[data-flow]').getAttribute('data-step')).toBe('1');
    expect(await page.getByRole('button', { name: 'Pause' }).count()).toBe(1);
    await page.getByRole('button', { name: 'Pause' }).click();
    expect(await page.getByRole('button', { name: 'Resume' }).count()).toBe(1);
    await close();
  });

  for (const options of [{ reducedMotion: 'reduce' as const }, { javaScriptEnabled: false }]) {
    it(`shows the composed scene and all seven captions without motion: ${JSON.stringify(options)}`, async () => {
      const { page, close } = await visit({ viewport: { width: 1280, height: 800 }, ...options });
      expect(await page.locator('[data-flow] [role="group"]').count()).toBe(0);
      expect(await page.locator('[data-flow]').getAttribute('data-step')).toBe('0');
      const captions = page.locator('[data-flow-captions] > li');
      expect(await captions.count()).toBe(7);
      for (let index = 0; index < 7; index += 1) {
        expect(await captions.nth(index).isVisible()).toBe(true);
      }
      expect(await page.locator('svg[data-layout="wide"]').isVisible()).toBe(true);
      expect(await page.locator('[data-flow] circle[class*="dot"]').count()).toBe(0);
      await close();
    });
  }

  for (const [width, shown, hidden] of [
    [375, 'tall', 'wide'],
    [390, 'tall', 'wide'],
    [1280, 'wide', 'tall'],
  ] as const) {
    it(`composes the scene for ${String(width)} px and keeps its words at 12 px or more`, async () => {
      const { page, close } = await visit({ viewport: { width, height: 900 } });
      expect(await page.locator(`svg[data-layout="${shown}"]`).isVisible()).toBe(true);
      expect(await page.locator(`svg[data-layout="${hidden}"]`).isVisible()).toBe(false);
      const smallest = await page.evaluate((layout) => {
        const svg = document.querySelector<SVGSVGElement>(`svg[data-layout="${layout}"]`);
        if (svg === null) return 0;
        const box = svg.viewBox.baseVal;
        const scale = svg.getBoundingClientRect().width / box.width;
        return Math.min(
          ...[...svg.querySelectorAll('text')].map(
            (text) => Number.parseFloat(getComputedStyle(text).fontSize) * scale,
          ),
        );
      }, shown);
      expect(smallest).toBeGreaterThanOrEqual(12);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await close();
    });
  }

  it('passes axe with a step chosen, in both colour modes', async () => {
    for (const scheme of ['light', 'dark'] as const) {
      const { page, close } = await visit({ colorScheme: scheme });
      await page.locator('[data-flow] [role="group"]').waitFor();
      await page.getByRole('button', { name: /Sign in once/u }).click();
      await page.waitForTimeout(700);
      const results = await new AxeBuilder({ page })
        .include('[data-section="signin"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        results.violations.map(
          (violation: Result) =>
            `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`,
        ),
        scheme,
      ).toEqual([]);
      await close();
    }
  });

  it('types the command over real text, in a box that never changes size', async () => {
    if (browser === undefined) throw new Error('the browser did not launch');
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      const holder = window as unknown as { shift: number };
      holder.shift = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const record = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (!record.hadRecentInput) holder.shift += record.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    const page = await context.newPage();
    await page.goto(home(), { waitUntil: 'domcontentloaded' });
    const command = await page.locator('code[data-shell="unix"]').textContent();
    expect(command).toContain('docker compose up -d');
    const heights: number[] = [];
    const sample = async (): Promise<void> => {
      heights.push((await page.locator('[data-panel="unix"]').boundingBox())?.height ?? 0);
    };
    await page.locator('code[data-shell="unix"]').waitFor({ state: 'visible' });
    await sample();
    await page.locator('[class*="typed"]').first().waitFor({ state: 'attached' });
    await sample();
    expect(await page.locator('code[data-shell="unix"]').textContent()).toBe(command);
    const before = await page.evaluate(() => (window as unknown as { shift: number }).shift);
    expect(before).toBeLessThan(0.001);
    await page.getByRole('button', { name: /^Copy/u }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(command);
    const axe = await new AxeBuilder({ page }).include('[data-panel="unix"]').analyze();
    expect(axe.violations.map((violation: Result) => violation.id)).toEqual([]);
    await page.locator('[class*="typed"]').first().waitFor({ state: 'detached' });
    await sample();
    await page.waitForTimeout(400);
    await sample();
    expect(heights.map((height) => Math.round(height))).toEqual(
      heights.map(() => Math.round(heights[0] ?? 0)),
    );
    await context.close();
  });

  it('shows the command at once, untyped, under reduced motion', async () => {
    const { page, close } = await visit({ reducedMotion: 'reduce' });
    await page.waitForTimeout(600);
    expect(await page.locator('[class*="typed"]').count()).toBe(0);
    const colour = await page
      .locator('code[data-shell="unix"]')
      .evaluate((element) => getComputedStyle(element).color);
    expect(colour).not.toBe('rgba(0, 0, 0, 0)');
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

  it('hydrates without a console error, so the server markup is kept', async () => {
    const errors: string[] = [];
    const { page, close } = await visit({}, (target) => {
      target.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      target.on('pageerror', (error) => {
        errors.push(String(error));
      });
      return Promise.resolve();
    });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    const detached = await page.evaluate(() => document.querySelector('[data-flow]')?.isConnected);
    expect(errors).toEqual([]);
    expect(detached).toBe(true);
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
