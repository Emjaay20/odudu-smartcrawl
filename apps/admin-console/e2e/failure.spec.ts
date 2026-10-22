import type { Page } from '@playwright/test';
import { expect, expectAccessible, expectFitsViewport, PHONE, signIn, test } from './fixtures';
import type { Problem } from './fixtures';
import { shots } from './page-inspection';
import { seeded } from './stack';

const { admin } = seeded();

// A page that throws when it renders, with no switch in the shipped code: the
// chunk the route imports is answered with a module whose page throws.
async function breakSigningKeys(page: Page): Promise<void> {
  await page.route('**/console/assets/signing-keys-*.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: "export const SigningKeysPage = () => { throw new Error('forced by the test'); };",
    }),
  );
}

// The toast region renders outside every route, above the router's own
// boundaries, so a throw there is what only the root fallback can catch. The
// entry chunk is served with its label expression replaced by a throw; the
// replacement is asserted, so a changed bundle fails here and not by passing.
async function breakNotifications(page: Page): Promise<void> {
  const label = '"aria-label":`Notifications`';
  await page.route('**/console/assets/index-*.js', async (route) => {
    const original = await (await route.fetch()).text();
    const patched = original.replace(
      label,
      '"aria-label":(()=>{throw new Error(`forced by the test`)})()',
    );
    expect(patched, 'the toast region is where this test expects it').not.toBe(original);
    await route.fulfill({ contentType: 'text/javascript', body: patched });
  });
}

// The browser and the app both log a render error; the test takes back what it
// caused, and reads the app's own line to match against what the page shows.
function loggedFailures(page: Page, problems: Problem[]): () => string[] {
  const lines: string[] = [];
  page.on('console', (message) => {
    if (message.text().startsWith('odudu console failure')) lines.push(message.text());
  });
  return () => {
    problems.splice(0, problems.length);
    return lines;
  };
}

async function detailsOf(page: Page): Promise<string> {
  return page.getByRole('region', { name: 'error details' }).innerText();
}

test('a page that fails to render shows the panel inside the shell, with an id and no message', async ({
  page,
  problems,
}) => {
  const logged = loggedFailures(page, problems);
  await signIn(page, admin);
  await breakSigningKeys(page);
  await page.goto(`/console/${admin.tenant}/keys`);

  const heading = page.getByRole('heading', { level: 1, name: 'Something went wrong' });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(page.getByRole('navigation', { name: `Areas of ${admin.tenant}` })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('This page could not be shown');
  await expect(page.locator('body')).not.toContainText('forced by the test');

  const details = await detailsOf(page);
  expect(details).toMatch(
    /^Error ID: [0-9A-Z]{8}\nPage: \/\$tenant\/keys\nTime: \d{4}-\d\d-\d\dT[\d:.]+Z$/u,
  );
  expect(details).not.toContain(admin.tenant);
  const id = /Error ID: ([0-9A-Z]{8})/u.exec(details)?.[1];
  expect(logged().some((line) => line.includes(`failure ${String(id)} (rendering)`))).toBe(true);

  await expectAccessible(page);
  await page.setViewportSize(PHONE);
  await expectFitsViewport(page, 'the failure panel on a phone');
  await shots(page, 'console-failure-route');
});

test('Copy details copies what the panel shows, and Try again draws a new id', async ({
  page,
  context,
  problems,
}) => {
  loggedFailures(page, problems);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signIn(page, admin);
  await breakSigningKeys(page);
  await page.goto(`/console/${admin.tenant}/keys`);
  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();

  const shown = await detailsOf(page);
  await page.getByRole('button', { name: 'Copy error details' }).click();
  await expect(page.getByRole('status')).toContainText('Copied error details');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(shown);

  await page.getByRole('button', { name: 'Try again' }).click();
  await expect.poll(() => detailsOf(page)).not.toBe(shown);
  await expect(page.getByRole('navigation', { name: `Areas of ${admin.tenant}` })).toBeVisible();
  problems.splice(0, problems.length);
});

test('Try again recovers once the cause is gone, with focus in the page', async ({
  page,
  problems,
}) => {
  loggedFailures(page, problems);
  await signIn(page, admin);
  // The page throws while a flag the test holds is set, and draws once it is not.
  await page.route('**/console/assets/signing-keys-*.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: "export const SigningKeysPage = () => { if (window.__breakKeys) throw new Error('forced by the test'); return 'Signing keys came back'; };",
    }),
  );
  await page.evaluate(() => Reflect.set(window, '__breakKeys', true));
  await page
    .getByRole('navigation', { name: `Areas of ${admin.tenant}` })
    .getByRole('link', { name: 'Signing keys' })
    .click();
  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();

  await page.evaluate(() => Reflect.set(window, '__breakKeys', false));
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Signing keys came back')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toHaveCount(0);
  await expect(page.locator('main')).toBeFocused();
  await expect(page.getByRole('navigation', { name: `Areas of ${admin.tenant}` })).toBeVisible();
  problems.splice(0, problems.length);
});

test('Back to overview leaves the failure behind, to a page that works', async ({
  page,
  problems,
}) => {
  loggedFailures(page, problems);
  await signIn(page, admin);
  await breakSigningKeys(page);
  await page.goto(`/console/${admin.tenant}/keys`);
  await page.getByRole('link', { name: 'Back to overview' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  problems.splice(0, problems.length);
});

test('a failure above every route shows the standalone fallback, and its reload loads the page again', async ({
  page,
  context,
  problems,
}) => {
  const logged = loggedFailures(page, problems);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await breakNotifications(page);
  await page.goto('/console/');

  const heading = page.getByRole('heading', { level: 1, name: 'Something went wrong' });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('forced by the test');
  const details = await detailsOf(page);
  expect(details).toMatch(/^Error ID: [0-9A-Z]{8}\nPage: .+\nTime: \d{4}-/u);
  const id = /Error ID: ([0-9A-Z]{8})/u.exec(details)?.[1];
  expect(logged().some((line) => line.includes(`failure ${String(id)} (rendering)`))).toBe(true);

  await page.getByRole('button', { name: 'Copy error details' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(details);

  await expectAccessible(page);
  await page.setViewportSize(PHONE);
  await expectFitsViewport(page, 'the root fallback on a phone');
  await shots(page, 'console-failure-root');

  const reloaded = page.waitForEvent('load');
  await page.getByRole('button', { name: 'Reload the console' }).click();
  await reloaded;
  await expect(heading).toBeVisible();
  expect(await detailsOf(page)).not.toBe(details);
  problems.splice(0, problems.length);
});
