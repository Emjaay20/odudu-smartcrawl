import type { Page } from '@playwright/test';
import {
  expect,
  expectAccessible,
  expectFitsViewport,
  signIn,
  tabsWithin,
  test,
  PHONE,
} from './fixtures';
import { inTenant, psql, seeded } from './stack';

const { mail } = seeded().config;

async function openDelivery(page: Page, tenant: string) {
  await page.goto(`/console/${tenant}/email`);
  await expect(page.getByRole('heading', { level: 1, name: 'Email' })).toBeVisible();
  const panel = page.getByRole('region', { name: 'Delivery', exact: true });
  await expect(panel).toBeVisible();
  const table = page.getByRole('grid', { name: `Mail of ${tenant}` });
  await expect(table).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  return { panel, table };
}

test('the latest mail is listed a page at a time, by status, and read again on Refresh', async ({
  page,
}) => {
  test.slow();
  const { main } = mail;
  await signIn(page, main);
  const { panel, table } = await openDelivery(page, main.tenant);
  await expect(table.getByRole('row')).toHaveCount(21);
  await expect(panel.getByRole('button', { name: 'Load more messages' })).toBeVisible();
  await expect(panel.getByText(/Oldest message still waiting/u)).toBeHidden();
  await expectAccessible(page);

  await panel.getByRole('button', { name: /Show/u }).click();
  await page.getByRole('option', { name: 'Failed' }).click();
  await expect(table.getByRole('row')).toHaveCount(3);
  await expect(table.getByText('connect ECONNREFUSED')).toHaveCount(2);
  await expect(table.getByText('failed-1@example.test')).toBeVisible();
  await expect(panel.getByText(/Holding view-users/u)).toBeHidden();
  await expectAccessible(page);

  psql(
    `insert into email_outbox (id, tenant_id, to_address, subject, body_text, body_html, next_attempt_at, attempts, last_error) values (gen_random_uuid(), ${inTenant(main.tenant)}, 'late@example.test', 'Reset your password', 'x', 'x', now() + interval '1 day', 99, 'relay refused')`,
  );
  await expect(table.getByRole('row')).toHaveCount(3);
  await panel.getByRole('button', { name: 'Refresh' }).click();
  await expect(table.getByRole('row')).toHaveCount(4);
  await expect(table.getByText('relay refused')).toBeVisible();

  await panel.getByRole('button', { name: /Show/u }).click();
  await page.getByRole('option', { name: 'Any status' }).click();
  await expect(table.getByRole('row')).toHaveCount(21);
  await panel.getByRole('button', { name: 'Load more messages' }).click();
  await expect(table.getByRole('row')).toHaveCount(41);
  await panel.getByRole('button', { name: 'Load more messages' }).click();
  await expect(table.getByRole('row')).toHaveCount(46);
  await expect(panel.getByRole('button', { name: 'Load more messages' })).toBeHidden();
  await expect(panel.getByText(/Oldest message still waiting/u)).toBeVisible();
  await expectAccessible(page);
});

test('the mail of one status is chosen and read again by keyboard alone', async ({ page }) => {
  test.slow();
  const { keyed } = mail;
  await signIn(page, keyed);
  const { panel, table } = await openDelivery(page, keyed.tenant);
  const show = panel.getByRole('button', { name: /Show/u });
  await tabsWithin(60)(page, show);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(table.getByRole('row')).toHaveCount(3);
  const refresh = panel.getByRole('button', { name: 'Refresh' });
  await tabsWithin(10)(page, refresh);
  await page.keyboard.press('Enter');
  await expect(table.getByRole('row')).toHaveCount(3);
  await expectAccessible(page);
});

test('an operator without view-users sees the recipients shortened, and is told so', async ({
  page,
}) => {
  const { fixed, fixedTenantOnly } = mail;
  await signIn(page, fixedTenantOnly);
  const { panel, table } = await openDelivery(page, fixed.tenant);
  await expect(table.getByText('s***@example.test').first()).toBeVisible();
  await expect(table.getByText('sent-1@example.test')).toHaveCount(0);
  await expect(panel.getByText(/Holding view-users shows them whole/u)).toBeVisible();
  await expectAccessible(page);
});

test('the delivery panel fits a phone', async ({ page }) => {
  test.slow();
  await page.setViewportSize(PHONE);
  await signIn(page, mail.fixed);
  await openDelivery(page, mail.fixed.tenant);
  await expectFitsViewport(page, 'email');
  await expectAccessible(page);
});
