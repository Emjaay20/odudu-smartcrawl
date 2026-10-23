// Drives a person's browser through the examples. The examples do not depend
// on Playwright; the repository's pinned copy is borrowed from the docs app.
import { createRequire } from 'node:module';

interface Fetched {
  headers(): Record<string, string>;
}
interface Route {
  request(): { url(): string };
  continue(options?: { url?: string }): Promise<void>;
  fetch(options: { maxRedirects: number }): Promise<Fetched>;
  fulfill(options: { response: Fetched; headers: Record<string, string> }): Promise<void>;
}
interface Locator {
  fill(value: string): Promise<void>;
  click(): Promise<void>;
  waitFor(): Promise<void>;
}
interface Context {
  cookies(url: string): Promise<{ name: string; value: string }[]>;
}
export interface Page {
  goto(url: string): Promise<unknown>;
  getByRole(role: string, options: { name: RegExp }): Locator;
  locator(selector: string): Locator;
  waitForURL(url: string, options: { timeout: number }): Promise<void>;
  innerText(selector: string): Promise<string>;
  url(): string;
  route(pattern: string, handler: (route: Route) => Promise<void>): Promise<void>;
  context(): Context;
  reload(): Promise<unknown>;
  evaluate<T>(run: () => T): Promise<T>;
  on(event: 'console', listener: (message: { type(): string; text(): string }) => void): void;
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

export async function browse<T>(run: (page: Page) => Promise<T>): Promise<T> {
  const browser = await chromium.launch();
  try {
    return await run(await browser.newPage());
  } finally {
    await browser.close();
  }
}

// Changes the address a redirect sends the browser to, as if it had been altered
// on its way. Playwright does not route the hop a redirect leads to, so the
// response that holds the redirect is the place to do it. `seen` gets the
// address and the cookies the browser holds for it.
export function rewriteRedirect(
  page: Page,
  pattern: string,
  change: (url: URL) => void = () => undefined,
  seen: (url: string, cookie: string) => void = () => undefined,
): Promise<void> {
  return page.route(pattern, async (route) => {
    const response = await route.fetch({ maxRedirects: 0 });
    const headers = { ...response.headers() };
    if (headers.location === undefined) return route.fulfill({ response, headers });
    const target = new URL(headers.location);
    change(target);
    const cookies = await page.context().cookies(target.href);
    seen(target.href, cookies.map(({ name, value }) => `${name}=${value}`).join('; '));
    await route.fulfill({ response, headers: { ...headers, location: target.href } });
  });
}

// Changes a request on its way out, as if a script or an extension had altered
// it. For what an app sends from script, where no redirect hop carries it.
export function rewriteRequest(
  page: Page,
  pattern: string,
  change: (url: URL) => void,
): Promise<void> {
  return page.route(pattern, (route) => {
    const target = new URL(route.request().url());
    change(target);
    return route.continue({ url: target.href });
  });
}

// From the app's front page to Odudu's sign-in form, typed in and submitted.
// The control that starts it is a link in a server-side app and a button in a
// single-page one.
export async function signIn(
  page: Page,
  app: string,
  username: string,
  password: string,
  control: 'link' | 'button' = 'link',
) {
  await page.goto(`${app}/`);
  await page.getByRole(control, { name: /sign in/i }).click();
  await page.locator('input[name=username]').fill(username);
  await page.locator('input[name=password]').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
}

export async function signInAndWaitForApp(
  page: Page,
  app: string,
  username: string,
  password: string,
  control: 'link' | 'button' = 'link',
): Promise<void> {
  await signIn(page, app, username, password, control);
  await page.waitForURL(`${app}/`, { timeout: 15_000 });
}
