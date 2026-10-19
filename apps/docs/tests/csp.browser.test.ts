import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { docsRoutes } from '@odudu/web-assets';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { distDir } from '#docs/tests/support/dist.ts';

let server: FastifyInstance | undefined;
let browser: Browser | undefined;
let origin = '';

// Served by the route the image ships, so the policy under test is the header
// the server sends and not a copy of it.
beforeAll(async () => {
  const instance = Fastify();
  await instance.register(docsRoutes(distDir('image')));
  origin = await instance.listen({ port: 0, host: '127.0.0.1' });
  server = instance;
  browser = await chromium.launch();
});

afterAll(async () => {
  await server?.close();
  await browser?.close();
});

interface Watch {
  violations: () => Promise<string[]>;
  foreign: string[];
  failures: string[];
}

// A violation exists only in the browser: a style or script made at run time is
// not in the HTML, so the walk listens for the browser's own report.
async function watch(context: BrowserContext, page: Page): Promise<Watch> {
  await context.addInitScript(() => {
    const seen: string[] = [];
    Object.assign(window, { cspViolations: seen });
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(`${event.violatedDirective} ${event.blockedURI} ${event.sample}`);
    });
  });
  const foreign: string[] = [];
  const failures: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol !== 'data:' && url.origin !== origin) foreign.push(request.url());
  });
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(message.text());
  });
  return {
    foreign,
    failures,
    violations: () =>
      page.evaluate(() => {
        const seen: unknown = Reflect.get(window, 'cspViolations');
        return Array.isArray(seen) ? seen.map(String) : [];
      }),
  };
}

async function expectClean(watched: Watch): Promise<void> {
  expect(await watched.violations()).toEqual([]);
  expect(watched.foreign).toEqual([]);
  expect(watched.failures).toEqual([]);
}

function requireBrowser(): Browser {
  if (browser === undefined) throw new Error('the browser did not launch');
  return browser;
}

describe('the image build under the policy the server sends', () => {
  it('sends the policy the walk runs under', async () => {
    const response = await fetch(`${origin}/docs/`);
    const policy = response.headers.get('content-security-policy') ?? '';
    expect(policy).toMatch(/^default-src 'self'; script-src 'self' 'sha256-/u);
    expect(policy).toContain("style-src-attr 'unsafe-hashes' 'sha256-");
    expect(policy).not.toMatch(/unsafe-inline|unsafe-eval/u);
  });

  it('runs under the policy with no violation, on a desktop: navigation, search, theme, code copy', async () => {
    const context = await requireBrowser().newContext({
      viewport: { width: 1280, height: 800 },
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await context.newPage();
    const watched = await watch(context, page);

    await page.goto(`${origin}/docs/`);
    await page.locator('nav.navbar a.navbar__link', { hasText: 'Quick start' }).click();
    await page.waitForURL(`${origin}/docs/quick-start/`);
    await expectClean(watched);

    const toggle = page.locator('button[class*="toggleButton"]').first();
    for (let click = 0; click < 3; click += 1) await toggle.click();
    await expectClean(watched);

    // The index is fetched when the box is first used, and from this origin.
    const index = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/docs/search-index.json',
    );
    await page.locator('input.navbar__search-input').fill('tenant');
    expect((await index).status()).toBe(200);
    await page.locator('input.navbar__search-input').press('Enter');
    await page.waitForTimeout(500);
    await expectClean(watched);

    await page.goto(`${origin}/docs/reference/generated/cli/`);
    const copy = page.locator('button[aria-label*="Copy"]').first();
    await copy.waitFor();
    await copy.click();
    await page.locator('button[aria-label*="Copied"]').first().waitFor();
    await expectClean(watched);
    await context.close();
  });

  it('runs under the policy with no violation at 390 px: the mobile menu and the theme toggle in it', async () => {
    const context = await requireBrowser().newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const watched = await watch(context, page);

    await page.goto(`${origin}/docs/`);
    await page.locator('button.navbar__toggle').click();
    await page.locator('.navbar-sidebar button[class*="toggleButton"]').first().click();
    await page.locator('.navbar-sidebar a', { hasText: 'Guides' }).first().click();
    await page.waitForURL(`${origin}/docs/guides/`);
    await expectClean(watched);
    await context.close();
  });

  it('reports a violation when the walk is broken on purpose, so a silent pass means something', async () => {
    const context = await requireBrowser().newContext();
    const page = await context.newPage();
    const watched = await watch(context, page);
    await page.goto(`${origin}/docs/`);
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'window.ran = true';
      document.body.append(script);
      const probe = document.createElement('div');
      probe.setAttribute('style', 'color: red');
      document.body.append(probe);
    });
    const seen = await watched.violations();
    expect(seen.some((line) => line.startsWith('script-src'))).toBe(true);
    expect(seen.some((line) => line.startsWith('style-src-attr'))).toBe(true);
    expect(await page.evaluate(() => 'ran' in window)).toBe(false);
    await context.close();
  });
});
