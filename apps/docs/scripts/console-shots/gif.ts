// Records the console for the README (pnpm docs:gif; --check replays the flow
// and writes nothing): sign in, open Clients, create a client, see it listed.
// Every frame is read for secrets before it is kept, by the guard the
// screenshots use, and the flow never issues a password or a client secret.
// Use a stack made for this, as for the screenshots: it creates the tenant demo
// and the client my-app, and stops if my-app is already there.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type BrowserContext, type Page } from '@playwright/test';
import {
  newPinnedContext,
  present,
  refuseSecrets,
  refused,
  SECRET_REQUEST,
  type Options,
} from './capture.ts';
import { encodeGif, type RawFrame } from './gif-encode.ts';

const OUTPUT = path.resolve(import.meta.dirname, '../../../../docs/media/console.gif');
const VIEWPORT = { width: 1000, height: 700 };
const WIDTH = 800;
const HEIGHT = 560;
const TENANT = 'demo';
const CLIENT = 'my-app';
const REDIRECT = 'http://localhost:8080/callback';

const required = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === '') throw new Error(`${name} is not set`);
  return value;
};

const base = (process.env.ODUDU_BASE ?? 'http://localhost:3000').replace(/\/+$/u, '');
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname) &&
  process.env.ODUDU_SCREENSHOTS_ALLOW_REMOTE !== '1'
) {
  throw new Error(`${base} is not this machine: the flow creates a tenant and a client`);
}
const options: Options = {
  base,
  adminUsername: required('ODUDU_ADMIN_EMAIL'),
  adminPassword: required('ODUDU_ADMIN_PASSWORD'),
  outDir: '',
  recordDir: '',
};

interface Kept {
  readonly png: Buffer;
  readonly delayMs: number;
}

async function keep(page: Page, label: string, delayMs: number): Promise<Kept> {
  await refuseSecrets(page, label, [options.adminPassword]);
  await present(page, options);
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await page.waitForTimeout(150);
  const png = await page.screenshot({ type: 'png', animations: 'disabled', caret: 'hide' });
  await refuseSecrets(page, label, refused(options));
  return { png, delayMs };
}

async function typeInto(
  page: Page,
  field: ReturnType<Page['getByLabel']>,
  text: string,
  frames: Kept[],
  label: string,
): Promise<void> {
  await field.click();
  for (const chunk of text.match(/.{1,3}/gu) ?? []) {
    await page.keyboard.type(chunk, { delay: 20 });
    frames.push(await keep(page, label, 110));
  }
}

async function tenantExists(page: Page): Promise<boolean> {
  await page.goto(`${base}/console/system/tenants`);
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.getByText(/^\d+ tenants?$/u).waitFor();
  return (await page.getByRole('row', { name: new RegExp(`^${TENANT}`, 'u') }).count()) > 0;
}

async function ensureTenant(page: Page): Promise<void> {
  if (await tenantExists(page)) return;
  await page.goto(`${base}/console/system/new-tenant`);
  await page.getByLabel('Name', { exact: true }).fill(TENANT);
  await page.getByRole('button', { name: 'Create tenant' }).click();
  await page.getByText(`${TENANT} was created`).waitFor();
}

async function flow(context: BrowserContext): Promise<Kept[]> {
  const page = await context.newPage();
  const frames: Kept[] = [];
  await page.goto(`${base}/console/`);
  await page.getByRole('heading', { name: 'Sign in' }).waitFor();
  frames.push(await keep(page, 'tenant question', 600));
  await typeInto(page, page.getByLabel(/tenant/iu), 'system', frames, 'tenant question');
  await page.getByRole('button', { name: 'Continue to sign-in' }).click();
  await page.getByLabel('Username').waitFor();
  frames.push(await keep(page, 'sign-in page', 400));
  await typeInto(page, page.getByLabel('Username'), options.adminUsername, frames, 'sign-in page');
  // A filled password field is never photographed: the password is typed and
  // sent between two frames.
  await page.getByLabel('Password').fill(options.adminPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(`${base}/console/system**`, { timeout: 15_000 });
  await ensureTenant(page);
  await page.goto(`${base}/console/${TENANT}`);
  await page.getByRole('heading', { level: 1 }).waitFor();
  frames.push(await keep(page, 'overview', 700));
  await page.getByRole('link', { name: 'Clients', exact: true }).first().click();
  await page.getByRole('heading', { name: 'Clients', exact: true }).waitFor();
  if ((await page.getByRole('row', { name: new RegExp(CLIENT, 'u') }).count()) > 0) {
    throw new Error(`${CLIENT} already exists in ${TENANT}: use a stack made for this`);
  }
  frames.push(await keep(page, 'clients', 700));
  await page.getByRole('link', { name: 'Create a client' }).first().click();
  await page.getByRole('heading', { name: 'Create a client' }).waitFor();
  frames.push(await keep(page, 'new client', 400));
  await typeInto(page, page.getByLabel('Client ID'), CLIENT, frames, 'new client');
  await page.getByLabel('Kind').click();
  await page.getByRole('option', { name: 'Public application' }).click();
  frames.push(await keep(page, 'new client', 500));
  await typeInto(
    page,
    page.getByRole('textbox', { name: 'Redirect URI' }).first(),
    REDIRECT,
    frames,
    'new client',
  );
  frames.push(await keep(page, 'new client', 600));
  await page.getByRole('button', { name: 'Create client' }).click();
  await page.getByRole('heading', { level: 1, name: CLIENT }).waitFor();
  frames.push(await keep(page, 'the new client', 900));
  await page.getByRole('link', { name: 'Clients', exact: true }).first().click();
  await page.getByRole('row', { name: new RegExp(CLIENT, 'u') }).waitFor();
  frames.push(await keep(page, 'clients, listed', 2200));
  return frames;
}

// Chromium resamples and reads the pixels, so no image library is needed.
async function raw(context: BrowserContext, frames: readonly Kept[]): Promise<RawFrame[]> {
  const page = await context.newPage();
  const made: RawFrame[] = [];
  for (const { png, delayMs } of frames) {
    const encoded = await page.evaluate(
      async ({ data, width, height }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const drawing = canvas.getContext('2d');
        if (drawing === null) throw new Error('no 2d canvas');
        drawing.imageSmoothingQuality = 'high';
        drawing.drawImage(image, 0, 0, width, height);
        const pixels = drawing.getImageData(0, 0, width, height).data;
        let binary = '';
        for (let at = 0; at < pixels.length; at += 0x8000) {
          binary += String.fromCharCode(...pixels.subarray(at, at + 0x8000));
        }
        return btoa(binary);
      },
      { data: png.toString('base64'), width: WIDTH, height: HEIGHT },
    );
    made.push({ rgba: new Uint8ClampedArray(Buffer.from(encoded, 'base64')), delayMs });
  }
  await page.close();
  return made;
}

const browser = await chromium.launch();
try {
  const context = await newPinnedContext(browser, VIEWPORT, 'dark');
  const sent: string[] = [];
  await context.route(
    (url) => SECRET_REQUEST.test(url.pathname),
    async (route) => {
      sent.push(route.request().url());
      await route.abort();
    },
  );
  const kept = await flow(context);
  if (sent.length > 0)
    throw new Error(`the flow sent a request that issues a secret: ${sent.join(', ')}`);
  const seconds = kept.reduce((sum, frame) => sum + frame.delayMs, 0) / 1000;
  if (process.argv.includes('--check')) {
    process.stdout.write(`the flow ran: ${String(kept.length)} frames, ${seconds.toFixed(1)} s\n`);
  } else {
    const gif = encodeGif(await raw(context, kept), WIDTH, HEIGHT);
    mkdirSync(path.dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, gif);
    process.stdout.write(
      `${OUTPUT}: ${String(kept.length)} frames, ${seconds.toFixed(1)} s, ${String(gif.length)} bytes\n`,
    );
  }
  await context.close();
} finally {
  await browser.close();
}
