// Drives a person's sign-in through a real browser. The examples do not depend
// on Playwright; the repository's pinned copy is borrowed from the docs app.
import { createRequire } from 'node:module';

interface Locator {
  fill(value: string): Promise<void>;
  click(): Promise<void>;
}
interface Page {
  goto(url: string): Promise<unknown>;
  getByRole(role: string, options: { name: RegExp }): Locator;
  locator(selector: string): Locator;
  waitForURL(url: string, options: { timeout: number }): Promise<void>;
  innerText(selector: string): Promise<string>;
  url(): string;
}
interface Browser {
  newPage(): Promise<Page>;
  close(): Promise<void>;
}
interface Playwright {
  chromium: { launch(): Promise<Browser> };
}

const require = createRequire(new URL('../../apps/docs/package.json', import.meta.url));
const { chromium } = require('@playwright/test') as Playwright;

export async function signInThroughBrowser(
  app: string,
  username: string,
  password: string,
): Promise<{ url: string; text: string }> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${app}/`);
    await page.getByRole('link', { name: /sign in/i }).click();
    await page.locator('input[name=username]').fill(username);
    await page.locator('input[name=password]').fill(password);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL(`${app}/`, { timeout: 15_000 });
    return { url: page.url(), text: await page.innerText('body') };
  } finally {
    await browser.close();
  }
}
