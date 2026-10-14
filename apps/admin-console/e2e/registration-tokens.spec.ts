import type { Locator, Page } from '@playwright/test';
import {
  expect,
  expectAccessible,
  expectFitsViewport,
  forgive,
  signIn,
  test,
  tabsWithin,
  gridWalk,
  takeSecret,
  PHONE,
  expectNowhere,
} from './fixtures';
import { psql, seeded, inTenant } from './stack';

const { admin, tenantOnly, clientsOnly } = seeded().access.tokens;
const TENANT = admin.tenant;

const IN_TENANT = inTenant(TENANT);

function liveWithUses(uses: number): string {
  return psql(
    `select count(*) from client_registration_tokens where tenant_id = ${IN_TENANT} and remaining_uses = ${String(uses)}`,
  );
}

function tokenIdWithUses(uses: number): string {
  return psql(
    `select id from client_registration_tokens where tenant_id = ${IN_TENANT} and remaining_uses = ${String(uses)} limit 1`,
  );
}

const tabTo = tabsWithin(120);

const arrowTo = gridWalk({ tabs: 60, step: 'ArrowDown' });

function rowWithUses(page: Page, uses: number): Locator {
  return page
    .getByRole('grid', { name: 'Registration tokens' })
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader') })
    .filter({ has: page.getByRole('gridcell', { name: String(uses), exact: true }) });
}

test('a token is minted and shown once, then nowhere; another is revoked', async ({ page }) => {
  test.slow();
  await signIn(page, admin);
  await page.goto(`/console/${TENANT}/registration-tokens`);
  await expect(page.getByRole('heading', { level: 1, name: 'Registration tokens' })).toBeVisible();
  await expect(rowWithUses(page, 5)).toHaveCount(1);
  await expect(page.getByText(/disappears from this list/u)).toBeVisible();
  await expectAccessible(page);

  await page.getByRole('textbox', { name: 'Uses' }).fill('7');
  await page.getByRole('textbox', { name: 'Lifetime' }).fill('7200');
  await page.keyboard.press('Tab');
  await expect(page.getByText('7200 s · 2 hours')).toBeVisible();
  await page.getByRole('button', { name: 'Mint token' }).click();
  const dialog = page.getByRole('dialog', { name: 'New registration token' });
  await expect(dialog).toBeVisible();
  await expectAccessible(page);
  const secret = await takeSecret(dialog);
  await expectNowhere(page, secret);
  await expect(rowWithUses(page, 7)).toHaveCount(1);
  expect(liveWithUses(7)).toBe('1');
  expect(
    psql(
      `select token_hash from client_registration_tokens where tenant_id = ${IN_TENANT} and remaining_uses = 7`,
    ),
  ).not.toContain(secret);
  await page.reload();
  await expect(rowWithUses(page, 7)).toHaveCount(1);
  expect(await page.content()).not.toContain(secret);

  const revoked = tokenIdWithUses(5);
  await rowWithUses(page, 5)
    .getByRole('button', { name: /^Revoke / })
    .click();
  const confirm = page.getByRole('alertdialog', { name: 'Revoke this token?' });
  await expect(confirm).toContainText('5 uses');
  await expectAccessible(page);
  await confirm.getByRole('button', { name: 'Revoke token' }).click();
  await expect(page.getByText('The token was revoked.')).toBeVisible();
  await expect(rowWithUses(page, 5)).toHaveCount(0);
  expect(psql(`select count(*) from client_registration_tokens where id = '${revoked}'`)).toBe('0');
  await expectAccessible(page);
});

test('a token gone behind the page is revoked as already gone, and the list is read again', async ({
  page,
  problems,
}) => {
  await signIn(page, admin);
  await page.goto(`/console/${TENANT}/registration-tokens`);
  await expect(rowWithUses(page, 4)).toHaveCount(1);
  const gone = tokenIdWithUses(4);
  psql(`delete from client_registration_tokens where id = '${gone}'`);
  await rowWithUses(page, 4)
    .getByRole('button', { name: /^Revoke / })
    .click();
  await page.getByRole('button', { name: 'Revoke token' }).click();
  await expect(page.getByText(/already gone/u)).toBeVisible();
  await expect(rowWithUses(page, 4)).toHaveCount(0);
  forgive(problems, `/registration-tokens/${gone}`);
  await expectAccessible(page);
});

test('a number outside its range is refused beside its field, and nothing is sent', async ({
  page,
}) => {
  await signIn(page, admin);
  await page.goto(`/console/${TENANT}/registration-tokens`);
  await page.getByRole('textbox', { name: 'Lifetime' }).fill('59');
  await page.getByRole('button', { name: 'Mint token' }).click();
  await expect(page.getByText(/from 60 seconds \(1 minute\) to 31536000 seconds/u)).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expectAccessible(page);
});

test('a token is minted and another revoked by keyboard alone', async ({ page }) => {
  await signIn(page, admin);
  await page.goto(`/console/${TENANT}/registration-tokens`);
  const uses = page.getByRole('textbox', { name: 'Uses' });
  await tabTo(page, uses);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('9');
  const mint = page.getByRole('button', { name: 'Mint token' });
  await tabTo(page, mint);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'New registration token' });
  await expect(dialog).toBeVisible();
  const acknowledge = dialog.getByRole('checkbox');
  await tabTo(page, acknowledge);
  await page.keyboard.press('Space');
  const close = dialog.getByRole('button', { name: 'Close' });
  await tabTo(page, close);
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(rowWithUses(page, 9)).toHaveCount(1);
  expect(liveWithUses(9)).toBe('1');

  const revoke = rowWithUses(page, 3).getByRole('button', { name: /^Revoke / });
  await arrowTo(page, page.getByRole('grid', { name: 'Registration tokens' }), revoke);
  await page.keyboard.press('Enter');
  const confirm = page.getByRole('alertdialog', { name: 'Revoke this token?' });
  await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByText('The token was revoked.')).toBeFocused();
  await expect(rowWithUses(page, 3)).toHaveCount(0);
  expect(liveWithUses(3)).toBe('0');
  await expectAccessible(page);
});

test('an operator holding manage-tenant alone is told what the tokens need, and has no link to them', async ({
  page,
}) => {
  await signIn(page, tenantOnly);
  await expect(page.getByRole('link', { name: 'Registration tokens' })).toHaveCount(0);
  await page.goto(`/console/${TENANT}/registration-tokens`);
  await expect(page.getByRole('note').filter({ hasText: 'Registration tokens needs' })).toHaveText(
    'Registration tokens needs the manage-clients capability.',
  );
  await expect(page.getByRole('button', { name: 'Mint token' })).toHaveCount(0);
  await expectAccessible(page);
});

test('an operator holding manage-clients alone mints and sees the list', async ({ page }) => {
  await signIn(page, clientsOnly);
  await page.goto(`/console/${TENANT}/registration-tokens`);
  await expect(page.getByRole('button', { name: 'Mint token' })).toBeVisible();
  await expect(page.getByRole('grid', { name: 'Registration tokens' })).toBeVisible();
  await expectAccessible(page);
});

test('the registration tokens page fits a phone, with the dialogs open', async ({ page }) => {
  test.slow();
  await page.setViewportSize(PHONE);
  await signIn(page, admin);
  await page.goto(`/console/${TENANT}/registration-tokens`);
  await expect(page.getByRole('grid', { name: 'Registration tokens' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expectFitsViewport(page, 'registration tokens');
  await expectAccessible(page);
  await page
    .getByRole('button', { name: /^Revoke / })
    .first()
    .click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await expectFitsViewport(page, 'revoke dialog');
  await expectAccessible(page);
});
