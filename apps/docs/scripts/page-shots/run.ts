// Photographs the pages a person sees while signing in, for the landing page
// (pnpm page-shots). The markup is what the server's own renderers return, in
// the stylesheet the server serves, so nothing here is drawn by hand. Writes
// static/server-pages/<page>-<theme>.webp, a "branded" copy of the sign-in
// page with only colour tokens swapped, and manifest.json with each size.
// Each picture is the card and a margin of the page's grid around it.
// Needs packages/instrument/dist (pnpm --filter @odudu/instrument build).
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type BrowserContext } from '@playwright/test';
import { DEFAULT_PAGE_LOCALE, type PageLocale, type RenderedPage } from '@odudu/kernel';
import { renderRegistrationForm } from '../../../../packages/account/src/view/registration-html.ts';
import { renderResetRequestForm } from '../../../../packages/account/src/view/reset-html.ts';
import { renderLoginForm } from '../../../../packages/protocol-oidc/src/view/authorize-html.ts';
import { brandStyle } from './brand.ts';

const THEMES = ['light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

const ORIGIN = 'http://pages.test';
const INSTRUMENT = path.resolve(import.meta.dirname, '../../../../packages/instrument/dist');
const OUT = path.resolve(import.meta.dirname, '../../static/server-pages');
const VIEWPORT = { width: 520, height: 1000 };
const MARGIN = 20;
const QUALITY = 0.82;

const SIGN_IN_PATH = '/tenants/acme/protocol/openid-connect/auth?client_id=notes';
const RULES = {
  minLength: 15,
  requireDigit: false,
  requireUppercase: false,
  requireLowercase: false,
  requireSpecial: false,
};

interface Shot {
  name: string;
  render: (locale: PageLocale) => RenderedPage;
}

function login(form: string, locale: PageLocale): RenderedPage {
  return renderLoginForm(
    'acme',
    'a-session',
    form,
    false,
    true,
    undefined,
    false,
    'Notes',
    { createAccount: '/create', resetPassword: '/reset' },
    locale,
  );
}

const SHOTS: Shot[] = [
  { name: 'sign-in', render: (locale) => login('password', locale) },
  {
    name: 'create-account',
    render: (locale) =>
      renderRegistrationForm('acme', { rules: RULES, signInPath: SIGN_IN_PATH }, locale),
  },
  {
    name: 'reset-password',
    render: (locale) => renderResetRequestForm('acme', { signInPath: SIGN_IN_PATH }, locale),
  },
  { name: 'second-factor', render: (locale) => login('otp', locale) },
];

const TYPES: Record<string, string> = {
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(path.join(directory, entry.name))
      : [path.join(directory, entry.name)],
  );
}

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

let pending = '';
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
  });
  await context.route(`${ORIGIN}/instrument/**`, async (route) => {
    const relative = new URL(route.request().url()).pathname.replace('/instrument/', '');
    const file = path.join(INSTRUMENT, relative);
    await route.fulfill({
      body: readFileSync(file),
      contentType: TYPES[path.extname(file)] ?? 'application/octet-stream',
    });
  });
  if (files(INSTRUMENT).length === 0) throw new Error('packages/instrument/dist is empty');
  await context.route(`${ORIGIN}/page`, async (route) => {
    await route.fulfill({ body: pending, contentType: 'text/html' });
  });

  mkdirSync(OUT, { recursive: true });
  const sizes: Record<string, { width: number; height: number }> = {};
  const jobs = [
    ...SHOTS.map((shot) => ({ ...shot, file: shot.name, brand: false })),
    ...SHOTS.filter((shot) => shot.name === 'sign-in').map((shot) => ({
      ...shot,
      file: 'sign-in-branded',
      brand: true,
    })),
  ];
  for (const job of jobs) {
    for (const theme of THEMES) {
      const locale: PageLocale = { ...DEFAULT_PAGE_LOCALE, theme: theme satisfies Theme };
      const html = job.render(locale).html;
      pending = job.brand ? html.replace('</head>', `${brandStyle()}\n</head>`) : html;
      const page = await context.newPage();
      await page.goto(`${ORIGIN}/page`);
      await page.evaluate(() => document.fonts.ready);
      const box = await page.locator('main').boundingBox();
      if (box === null) throw new Error(`${job.file} has no main element`);
      const clip = {
        x: Math.floor(box.x - MARGIN),
        y: Math.floor(box.y - MARGIN),
        width: Math.ceil(box.width + 2 * MARGIN),
        height: Math.ceil(box.height + 2 * MARGIN),
      };
      const png = await page.screenshot({ clip });
      await page.close();
      writeFileSync(path.join(OUT, `${job.file}-${theme}.webp`), await toWebp(context, png));
      sizes[job.file] = { width: clip.width, height: clip.height };
    }
  }
  writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(sizes, null, 2)}\n`);
} finally {
  await browser.close();
}
