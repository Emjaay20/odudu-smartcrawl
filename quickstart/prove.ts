// Signs in to the console as the first administrator, in a real browser, the
// way the quick start tells a reader to. Run by prove.sh.
//   node quickstart/prove.ts <base-url> <email> <password>
// The browser comes from the docs app's pinned Playwright.
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

interface Locator {
  fill(value: string): Promise<void>;
  click(): Promise<void>;
  waitFor(options: { timeout: number }): Promise<void>;
  or(other: Locator): Locator;
  isVisible(): Promise<boolean>;
}
interface Page {
  goto(url: string): Promise<unknown>;
  getByLabel(text: string): Locator;
  getByText(text: string): Locator;
  getByRole(role: string, options: { name: string; exact?: boolean; level?: number }): Locator;
  waitForURL(url: string, options: { timeout: number }): Promise<void>;
}
interface Browser {
  newPage(): Promise<Page>;
  close(): Promise<void>;
}
interface Chromium {
  launch(): Promise<Browser>;
}

const STEP_MS = 20_000;

function isChromium(value: unknown): value is Chromium {
  return typeof value === 'object' && value !== null && 'launch' in value;
}

async function loadChromium(): Promise<Chromium> {
  const require = createRequire(new URL('../apps/docs/package.json', import.meta.url));
  const loaded: unknown = await import(pathToFileURL(require.resolve('@playwright/test')).href);
  const holders = [loaded, (loaded as { default?: unknown }).default];
  for (const holder of holders) {
    const chromium = (holder as { chromium?: unknown } | undefined)?.chromium;
    if (isChromium(chromium)) return chromium;
  }
  throw new Error('@playwright/test did not export chromium');
}

async function signIn(page: Page, base: string, email: string, password: string): Promise<void> {
  await page.goto(`${base}/console/`);
  await page.getByLabel('Which tenant do you administer?').fill('system');
  await page.getByRole('button', { name: 'Continue to sign-in' }).click();
  await page.getByLabel('Username').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  // A generated password has to be changed first; one the person chose does not.
  const change = page.getByRole('heading', { name: 'Change your password', level: 1 });
  const overview = page.getByRole('heading', { name: 'Overview', level: 1 });
  await change.or(overview).waitFor({ timeout: STEP_MS });
  if (await change.isVisible()) {
    await page.getByLabel('New password').fill(randomBytes(18).toString('base64url'));
    await page.getByRole('button', { name: 'Update password' }).click();
  }

  await page.waitForURL(`${base}/console/system`, { timeout: STEP_MS });
  await overview.waitFor({ timeout: STEP_MS });
  await page.getByRole('region', { name: 'Menu' }).waitFor({ timeout: STEP_MS });
  await page.getByText(`Signed in as ${email}`).waitFor({ timeout: STEP_MS });
}

const [base, email, password] = process.argv.slice(2);
if (base === undefined || email === undefined || password === undefined) {
  throw new Error('usage: prove.ts <base-url> <email> <password>');
}

const browser = await (await loadChromium()).launch();
try {
  await signIn(await browser.newPage(), base, email, password);
  console.log(`signed in to ${base}/console/ as ${email}`);
} finally {
  await browser.close();
}
