import type { Locator, Page } from '@playwright/test';
import { expect, expectAccessible, expectFitsViewport, forgive, signIn, test } from './fixtures';
import { psql, seeded } from './stack';

const { keys } = seeded().access;
const PHONE = { width: 390, height: 844 };

function keysOf(tenant: string): string {
  return psql(
    `select coalesce(string_agg(status, ',' order by status), '') from signing_keys where tenant_id = (select id from tenants where name = '${tenant}')`,
  );
}

function kidOf(tenant: string, status: string): string {
  return psql(
    `select kid from signing_keys where status = '${status}' and tenant_id = (select id from tenants where name = '${tenant}') order by created_at desc limit 1`,
  );
}

// The key was published `hours` ago, which is all its age is known by.
function publishedAgo(tenant: string, status: string, hours: number): void {
  psql(
    `update signing_keys set created_at = now() - interval '${String(hours)} hours' where status = '${status}' and tenant_id = (select id from tenants where name = '${tenant}')`,
  );
}

async function openKeys(page: Page, tenant: string): Promise<void> {
  await page.goto(`/console/${tenant}/keys`);
  await expect(page.getByRole('heading', { level: 1, name: 'Signing keys' })).toBeVisible();
  await expect(page.getByRole('grid', { name: 'Active keys' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
}

function row(page: Page, lane: string, kid: string): Locator {
  return page
    .getByRole('grid', { name: `${lane} keys` })
    .getByRole('row', { name: new RegExp(kid, 'u') });
}

async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let pressed = 0; pressed < 150; pressed += 1) {
    if (await target.evaluate((node) => node === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

// Tab enters a grid once; arrow keys move between its cells, and a row's
// buttons are in its last cell.
async function arrowTo(page: Page, grid: Locator, target: Locator): Promise<void> {
  for (let pressed = 0; pressed < 80; pressed += 1) {
    if (await grid.evaluate((node) => node.contains(document.activeElement))) break;
    await page.keyboard.press('Tab');
  }
  for (let pressed = 0; pressed < 8; pressed += 1) {
    if (await page.evaluate(() => document.activeElement?.tagName === 'BUTTON')) break;
    await page.keyboard.press('ArrowRight');
  }
  for (let pressed = 0; pressed < 12; pressed += 1) {
    if (await target.evaluate((node) => node === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

test('a key is staged, promoted, retired and deleted, and the lanes follow the database', async ({
  page,
  problems,
}) => {
  test.slow();
  const { main } = keys;
  await signIn(page, main);
  await openKeys(page, main.tenant);
  const original = kidOf(main.tenant, 'active');
  expect(keysOf(main.tenant)).toBe('active');
  await expect(row(page, 'Active', original)).toContainText('cannot be retired while it is active');
  await expect(row(page, 'Active', original).getByRole('button')).toHaveCount(0);
  await expect(page.getByText('No rotating keys')).toBeVisible();
  await expectAccessible(page);

  await page.getByRole('button', { name: 'Stage key' }).click();
  await expect(page.getByText(/ key, .*, was staged/u)).toBeVisible();
  await expect.poll(() => keysOf(main.tenant)).toBe('active,rotating');
  const staged = kidOf(main.tenant, 'rotating');
  await expect(row(page, 'Rotating', staged)).toContainText('Not ready');
  await expectAccessible(page);

  publishedAgo(main.tenant, 'active', 3);
  publishedAgo(main.tenant, 'rotating', 2);
  await openKeys(page, main.tenant);
  await expect(row(page, 'Rotating', staged)).toContainText('Ready to promote');

  await page.getByRole('button', { name: `Promote ${staged}` }).click();
  const promote = page.getByRole('alertdialog', { name: 'Promote this key?' });
  await expect(promote).toContainText('signs every new token');
  await expect(promote).not.toContainText('Ready from');
  await expectAccessible(page);
  await promote.getByRole('button', { name: 'Promote key' }).click();
  await expect(page.getByRole('status', { name: 'Last key action' })).toContainText(
    `${staged} is now the active key`,
  );
  await expect.poll(() => kidOf(main.tenant, 'active')).toBe(staged);
  await expect(row(page, 'Active', staged)).toBeVisible();
  await expect(row(page, 'Rotating', original)).toContainText('older than the active key');
  await expectAccessible(page);

  await page.getByRole('button', { name: `Retire ${original}` }).click();
  const retire = page.getByRole('alertdialog', { name: 'Retire this key?' });
  const confirm = retire.getByRole('button', { name: 'Retire key' });
  await expect(confirm).toBeDisabled();
  await expectAccessible(page);
  await expect(retire).toContainText('this console session ends');
  await retire.getByRole('textbox').fill(original);
  // The console's own token was signed by the key being retired, so the
  // gateway ends the console session and the console signs in again.
  const ended = page.waitForResponse(
    (response) => response.url().includes('/keys?status=') && response.status() === 401,
  );
  const resumed = page.waitForResponse(
    (response) => response.url().endsWith('/console/api/session') && response.status() === 200,
  );
  await confirm.click();
  expect(((await (await ended).json()) as { type: string }).type).toBe(
    'about:blank#console-session-ended',
  );
  await resumed;
  for (const status of ['rotating', 'active', 'retired']) {
    forgive(problems, `/keys?status=${status}`);
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Signing keys' })).toBeVisible();
  await expect(row(page, 'Retired', original)).toBeVisible();
  await expect(row(page, 'Active', staged)).toBeVisible();
  await expect.poll(() => keysOf(main.tenant)).toBe('active,retired');

  await page.getByRole('button', { name: `Delete ${original}` }).click();
  const remove = page.getByRole('alertdialog', { name: 'Delete this key?' });
  await expect(remove).toContainText('cannot be undone');
  await expectAccessible(page);
  await remove.getByRole('button', { name: 'Delete key' }).click();
  await expect(page.getByText('No retired keys')).toBeVisible();
  await expect.poll(() => keysOf(main.tenant)).toBe('active');
  await expectAccessible(page);
});

test('a key staged a moment ago is promoted all the same, with the reason it is not ready said', async ({
  page,
}) => {
  const { young } = keys;
  await signIn(page, young);
  await openKeys(page, young.tenant);
  await page.getByRole('button', { name: 'Stage key' }).click();
  await expect.poll(() => keysOf(young.tenant)).toBe('active,rotating');
  const staged = kidOf(young.tenant, 'rotating');
  await expect(row(page, 'Rotating', staged)).toContainText(/Ready from \d{4}-\d{2}-\d{2}/u);

  await page.getByRole('button', { name: `Promote ${staged}` }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Promote this key?' });
  await expect(dialog).toContainText(/Ready from \d{4}-\d{2}-\d{2}/u);
  await expect(dialog).toContainText('the server does not refuse it');
  await expectAccessible(page);
  await dialog.getByRole('button', { name: 'Promote key' }).click();
  await expect.poll(() => kidOf(young.tenant, 'active')).toBe(staged);
  await expect(row(page, 'Active', staged)).toBeVisible();
});

test('a key promoted behind the open page cannot be retired, and the server’s refusal is said beside the action', async ({
  page,
  problems,
}) => {
  test.slow();
  const { raced } = keys;
  await signIn(page, raced);
  await openKeys(page, raced.tenant);
  await page.getByRole('button', { name: 'Stage key' }).click();
  await expect.poll(() => keysOf(raced.tenant)).toBe('active,rotating');
  const staged = kidOf(raced.tenant, 'rotating');
  const retire = page.getByRole('button', { name: `Retire ${staged}` });
  await expect(retire).toBeVisible();

  const tenant = `(select id from tenants where name = '${raced.tenant}')`;
  psql(
    `update signing_keys set status = 'rotating' where status = 'active' and tenant_id = ${tenant}; update signing_keys set status = 'active' where kid = '${staged}' and tenant_id = ${tenant}`,
  );
  await retire.click();
  const dialog = page.getByRole('alertdialog', { name: 'Retire this key?' });
  await dialog.getByRole('textbox').fill(staged);
  await dialog.getByRole('button', { name: 'Retire key' }).click();
  await expect(dialog.getByRole('alert')).toContainText('The active key cannot be retired');
  await expect(dialog.getByRole('alert')).toContainText('Promote another key first');
  await expectAccessible(page);
  forgive(problems, '/retire');
  expect(kidOf(raced.tenant, 'active')).toBe(staged);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(row(page, 'Active', staged)).toBeVisible();
  await expect(row(page, 'Active', staged).getByRole('button')).toHaveCount(0);
});

test('a key is staged and promoted by keyboard alone, the focus landing on what happened', async ({
  page,
}) => {
  test.slow();
  const { keyed } = keys;
  await signIn(page, keyed);
  await openKeys(page, keyed.tenant);
  const stage = page.getByRole('button', { name: 'Stage key' });
  await tabTo(page, stage);
  await page.keyboard.press('Enter');
  await expect.poll(() => keysOf(keyed.tenant)).toBe('active,rotating');
  const staged = kidOf(keyed.tenant, 'rotating');

  const promote = page.getByRole('button', { name: `Promote ${staged}` });
  await expect(promote).toBeVisible();
  await arrowTo(page, page.getByRole('grid', { name: 'Rotating keys' }), promote);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('alertdialog', { name: 'Promote this key?' });
  await expect(dialog).toBeVisible();
  const confirm = dialog.getByRole('button', { name: 'Promote key' });
  await tabTo(page, confirm);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status', { name: 'Last key action' })).toBeFocused();
  await expect.poll(() => kidOf(keyed.tenant, 'active')).toBe(staged);
  await expectAccessible(page);
});

test('an operator holding manage-keys alone manages the keys', async ({ page }) => {
  await signIn(page, keys.fixedKeysOnly);
  await openKeys(page, keys.fixed.tenant);
  await expect(page.getByRole('button', { name: 'Stage key' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Signing keys' })).toBeVisible();
  await expectAccessible(page);
});

test('an operator holding manage-tenant alone is told what the keys need, and has no link to them', async ({
  page,
}) => {
  await signIn(page, keys.fixedTenantOnly);
  await page.goto(`/console/${keys.fixed.tenant}/keys`);
  await expect(page.getByRole('note').filter({ hasText: 'Signing keys needs' })).toHaveText(
    'Signing keys needs the manage-keys capability.',
  );
  await expect(page.getByRole('link', { name: 'Signing keys' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Stage key' })).toHaveCount(0);
  await expectAccessible(page);
});

test('the signing keys page fits a phone', async ({ page }) => {
  test.slow();
  await page.setViewportSize(PHONE);
  await signIn(page, keys.fixed);
  await openKeys(page, keys.fixed.tenant);
  await expectFitsViewport(page, 'signing keys');
  await expectAccessible(page);
});
