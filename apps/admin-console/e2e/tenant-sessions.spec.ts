import type { Browser, Page } from '@playwright/test';
import {
  expect,
  expectAccessible,
  expectFitsViewport,
  signIn,
  tabsWithin,
  test,
  PHONE,
  type Problem,
} from './fixtures';
import { psql, seeded, inTenant } from './stack';

const { sessions, system } = seeded();

function live(tenant: string): number {
  return Number(
    psql(
      `select count(*) from sessions where tenant_id = ${inTenant(tenant)} and secret_hash is not null and expires_at > now()`,
    ),
  );
}

function ended(problems: Problem[]): void {
  const kept = problems.filter((problem) => !problem.text.includes('status of 401'));
  problems.splice(0, problems.length, ...kept);
}

async function openSessions(page: Page, tenant: string): Promise<void> {
  await page.goto(`/console/${tenant}/sessions`);
  await expect(page.getByRole('heading', { level: 1, name: 'Sessions' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
}

// Signed in to the tenant in a browser of its own, which leaves a session
// there that the operator under test does not hold.
async function walkerSignsIn(
  browser: Browser,
  account: { tenant: string; username: string; password: string },
): Promise<Page> {
  const walker = await (await browser.newContext()).newPage();
  await signIn(walker, account);
  await expect(walker.getByRole('heading', { level: 1 }).first()).toBeVisible();
  return walker;
}

test('the sessions are listed a page at a time, each naming its subject', async ({ page }) => {
  const { admin } = sessions.list;
  await signIn(page, admin);
  await openSessions(page, admin.tenant);
  const table = page.getByRole('grid', { name: 'Sessions' });
  await expect(table.getByRole('row')).toHaveCount(51);
  await expect(table.getByRole('row').nth(1)).toContainText(admin.username);
  await expect(table.getByText('none').first()).toBeVisible();
  await expectAccessible(page);

  await page.getByRole('button', { name: 'Load more sessions' }).click();
  await expect.poll(() => table.getByRole('row').count()).toBeGreaterThan(51);
  await expectAccessible(page);

  await table
    .getByRole('link', { name: `${admin.username}, open the subject` })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/console/${admin.tenant}/subjects/`, 'u'));
});

test('every session in a tenant is ended by typing its name, and the sessions of others end with it', async ({
  page,
  browser,
}) => {
  const { tenant, walker } = sessions.flow;
  const other = await walkerSignsIn(browser, walker);
  await signIn(page, system);
  await openSessions(page, tenant);
  const table = page.getByRole('grid', { name: 'Sessions' });
  await expect(table.getByRole('row', { name: new RegExp(walker.username, 'u') })).toBeVisible();
  expect(live(tenant)).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'End every session' }).click();
  const dialog = page.getByRole('alertdialog', { name: `End every session in ${tenant}?` });
  await expect(dialog).toContainText(`Every live session in ${tenant} ends, whoever holds it`);
  await expect(dialog).not.toContainText('Your own console session');
  const confirm = dialog.getByRole('button', { name: 'End every session' });
  await expect(confirm).toBeDisabled();
  await expectAccessible(page);
  await dialog.getByRole('textbox').fill(tenant);
  await confirm.click();
  await expect(page.getByText(/sessions? in .* ended\./u)).toBeVisible();
  await expect.poll(() => live(tenant)).toBe(0);
  await expect(page.getByText('No sessions yet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'End every session' })).toBeDisabled();
  await expectAccessible(page);
  expect(
    psql(
      `select count(*) from audit_events where tenant_id = ${inTenant(tenant)} and action = 'session.end_all' and detail ->> 'ended' is not null`,
    ),
  ).not.toBe('0');
  await other.context().close();
});

test('an administrator ending the sessions of their own tenant is told it ends theirs, and is signed out', async ({
  page,
  problems,
}) => {
  const { own } = sessions;
  await signIn(page, own);
  await openSessions(page, own.tenant);
  await page.getByRole('button', { name: 'End every session' }).click();
  const dialog = page.getByRole('alertdialog', { name: `End every session in ${own.tenant}?` });
  await expect(dialog).toContainText(
    'Your own console session is one of them: the console signs you out at its next request.',
  );
  await expectAccessible(page);
  await dialog.getByRole('textbox').fill(own.tenant);
  await dialog.getByRole('button', { name: 'End every session' }).click();
  await expect(page.getByLabel('Username')).toBeVisible({ timeout: 15_000 });
  ended(problems);
  expect(live(own.tenant)).toBe(0);
});

test('every session is ended by keyboard alone', async ({ page, browser }) => {
  const { tenant, walker } = sessions.keyed;
  const other = await walkerSignsIn(browser, walker);
  await signIn(page, system);
  await openSessions(page, tenant);
  await expect(page.getByRole('grid', { name: 'Sessions' })).toBeVisible();
  const button = page.getByRole('button', { name: 'End every session' });
  await tabsWithin(80)(page, button);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('alertdialog', { name: `End every session in ${tenant}?` });
  await expect(dialog.getByRole('textbox')).toBeFocused();
  await page.keyboard.type(tenant);
  await page.keyboard.press('Enter');
  await expect.poll(() => live(tenant)).toBe(0);
  await expect(page.getByText('No sessions yet')).toBeVisible();
  await expectAccessible(page);
  await other.context().close();
});

test('an operator without manage-sessions is told what the page needs, and has no link to it', async ({
  page,
}) => {
  const { tenantOnly } = sessions.list;
  await signIn(page, tenantOnly);
  await page.goto(`/console/${tenantOnly.tenant}/sessions`);
  await expect(page.getByRole('note').filter({ hasText: 'Sessions needs' })).toHaveText(
    'Sessions needs the manage-sessions capability.',
  );
  await expect(page.getByRole('link', { name: 'Sessions' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'End every session' })).toHaveCount(0);
  await expectAccessible(page);
});

test('the sessions page fits a phone', async ({ page }) => {
  const { admin } = sessions.list;
  await page.setViewportSize(PHONE);
  await signIn(page, admin);
  await openSessions(page, admin.tenant);
  await expect(page.getByRole('grid', { name: 'Sessions' })).toBeVisible();
  await expectFitsViewport(page, 'sessions');
  await page.getByRole('button', { name: 'End every session' }).click();
  await expect(
    page.getByRole('alertdialog', { name: `End every session in ${admin.tenant}?` }),
  ).toBeVisible();
  await expectFitsViewport(page, 'end every session');
  await expectAccessible(page);
});
