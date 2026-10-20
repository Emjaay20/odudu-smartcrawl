import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { findSecrets, type Visible } from './guard.ts';
import type { Context, Expectation, Screen } from './screen.ts';

export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export interface Options {
  readonly base: string;
  readonly adminUsername: string;
  readonly adminPassword: string;
  readonly outDir: string;
  readonly width?: number;
  readonly height?: number;
}

export interface ManifestEntry {
  readonly width: number;
  readonly height: number;
}

const QUALITY = 0.86;

async function expectShown(page: Page, screen: Screen): Promise<void> {
  const locate = (expectation: Expectation): ReturnType<Page['locator']> =>
    'heading' in expectation
      ? page.getByRole('heading', { name: expectation.heading, exact: true }).first()
      : 'label' in expectation
        ? page.getByLabel(expectation.label, { exact: true }).first()
        : page.getByRole(expectation.role, { name: expectation.name, exact: true }).first();
  for (const expectation of screen.expect) {
    try {
      await locate(expectation).waitFor({ timeout: 10_000 });
    } catch {
      throw new Error(
        `screen ${screen.name}: the console does not show ${JSON.stringify(expectation)}`,
      );
    }
  }
}

async function visible(page: Page): Promise<Visible> {
  return page.evaluate(() => ({
    text: document.body.innerText,
    fieldValues: [...document.querySelectorAll('input:not([type=password]), textarea')].map(
      (element) => (element as HTMLInputElement).value,
    ),
    passwordFieldsFilled: [...document.querySelectorAll('input[type=password]')].filter(
      (element) => (element as HTMLInputElement).value !== '',
    ).length,
    dialogTexts: [...document.querySelectorAll('[role=dialog], [role=alertdialog]')].map(
      (element) => (element as HTMLElement).innerText,
    ),
  }));
}

// Chromium encodes WebP from a canvas, so no image library is needed.
async function toWebp(context: BrowserContext, png: Buffer): Promise<Buffer> {
  const page = await context.newPage();
  const encoded = await page.evaluate(
    async ({ data, quality }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext('2d')?.drawImage(image, 0, 0);
      return canvas.toDataURL('image/webp', quality).split(',')[1] ?? '';
    },
    { data: png.toString('base64'), quality: QUALITY },
  );
  await page.close();
  return Buffer.from(encoded, 'base64');
}

async function signIn(page: Page, options: Options): Promise<void> {
  await page.goto(`${options.base}/console/`);
  await page.getByLabel(/tenant/iu).fill('system');
  await page.getByRole('button', { name: 'Continue to sign-in' }).click();
  await page.getByLabel('Username').fill(options.adminUsername);
  await page.getByLabel('Password').fill(options.adminPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  try {
    await page.waitForURL(`${options.base}/console/system**`, { timeout: 15_000 });
  } catch {
    throw new Error(
      'the administrator did not reach the console: a generated password has to be changed first, ' +
        'so start the stack with ODUDU_ADMIN_PASSWORD set',
    );
  }
}

async function shoot(
  page: Page,
  screen: Screen,
  context: Context,
  options: Options,
): Promise<Buffer> {
  await screen.open(page, context);
  await expectShown(page, screen);
  await page.evaluate(() => document.fonts.ready.then(() => true));
  const secrets = findSecrets(await visible(page), [options.adminPassword]);
  if (secrets.length > 0) {
    throw new Error(`screen ${screen.name} was not captured: ${secrets.join('; ')}`);
  }
  return page.screenshot({ type: 'png' });
}

/**
 * Photographs each screen in each theme, signed out screens first, and writes
 * `<name>-light.webp`, `<name>-dark.webp` and a manifest of sizes.
 */
export async function captureScreens(
  screens: readonly Screen[],
  options: Options,
): Promise<Record<string, ManifestEntry>> {
  mkdirSync(options.outDir, { recursive: true });
  const viewport = { width: options.width ?? 1100, height: options.height ?? 820 };
  const manifest: Record<string, ManifestEntry> = {};
  const context: Context = { base: options.base, tenant: 'demo' };
  const browser: Browser = await chromium.launch();
  try {
    for (const theme of THEMES) {
      const browserContext = await browser.newContext({
        viewport,
        colorScheme: theme,
        reducedMotion: 'reduce',
      });
      const page = await browserContext.newPage();
      let signedIn = false;
      const ordered = [...screens].sort((a, b) => Number(a.signedIn) - Number(b.signedIn));
      for (const screen of ordered) {
        if (screen.signedIn && !signedIn) {
          await signIn(page, options);
          signedIn = true;
        }
        const png = await shoot(page, screen, context, options);
        const webp = await toWebp(browserContext, png);
        writeFileSync(path.join(options.outDir, `${screen.name}-${theme}.webp`), webp);
        manifest[screen.name] = viewport;
        await screen.leave?.(page, context);
      }
      await browserContext.close();
    }
  } finally {
    await browser.close();
  }
  writeFileSync(
    path.join(options.outDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
}
