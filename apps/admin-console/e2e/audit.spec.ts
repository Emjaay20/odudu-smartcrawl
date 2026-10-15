import { readFileSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import {
  expect,
  expectAccessible,
  expectFitsViewport,
  forgive,
  signIn,
  tabsWithin,
  takeSecret,
  test,
  PHONE,
} from './fixtures';
import { seeded } from './stack';

const { admin, viewer, usersOnly, clientId } = seeded().audit;
const { other } = seeded();
const TENANT = admin.tenant;
const AT = `/console/${TENANT}/audit`;
const { system } = seeded();

const tabTo = tabsWithin(160);

function trail(page: Page): Locator {
  return page.getByRole('grid', { name: 'Audit events' });
}

function rowsOf(page: Page): Locator {
  return trail(page)
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader') });
}

async function apply(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Apply filters' }).click();
}

// Tab enters the grid once and the arrow keys move between its cells, so a
// row's last button is reached by walking right along the row.
async function reachInGrid(page: Page, target: Locator): Promise<void> {
  const grid = trail(page);
  for (let pressed = 0; pressed < 160; pressed += 1) {
    if (await grid.evaluate((node) => node.contains(document.activeElement))) break;
    await page.keyboard.press('Tab');
  }
  for (let pressed = 0; pressed < 12; pressed += 1) {
    if (await target.evaluate((node) => node === document.activeElement)) return;
    await page.keyboard.press('ArrowRight');
  }
  await expect(target).toBeFocused();
}

async function typeDate(page: Page, name: string, local: string): Promise<void> {
  await page.getByLabel(name, { exact: true }).fill(local);
}

test('the trail is filtered, paged by cursor and opened to a row, with no count', async ({
  page,
}) => {
  test.slow();
  await signIn(page, admin);
  await page.goto(AT);
  await expect(page.getByRole('heading', { level: 1, name: 'Audit trail' })).toBeVisible();
  await expect(page.getByText(/The audit trail has no count/u)).toBeVisible();
  await expect(trail(page)).toBeVisible();
  await expectAccessible(page);

  await page.getByRole('textbox', { name: 'Action', exact: true }).fill('e2e.bulk');
  await apply(page);
  await expect(page).toHaveURL(/action=e2e\.bulk/u);
  await expect(rowsOf(page)).toHaveCount(50);
  await expect(page.getByText(/50 events loaded/u)).toBeVisible();
  await expectAccessible(page);

  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page).toHaveURL(/after=/u);
  await expect(rowsOf(page)).toHaveCount(50);
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(rowsOf(page)).toHaveCount(20);
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();
  await page.getByRole('button', { name: 'Previous page' }).click();
  await page.getByRole('button', { name: 'Previous page' }).click();
  await expect(page).not.toHaveURL(/after=/u);
  await expect(rowsOf(page)).toHaveCount(50);

  await expect(rowsOf(page)).toHaveCount(50);
  await page.getByRole('button', { name: 'Load more audit events' }).click();
  await expect(rowsOf(page)).toHaveCount(100);

  await page.getByRole('button', { name: 'Details of e2e.bulk' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Audit event' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Event id', { exact: true })).toBeVisible();
  await expect(dialog.getByText('203.0.113.7')).toBeVisible();
  await expectAccessible(page);
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
});

test('filters survive a reload and follow back and forward', async ({ page }) => {
  test.slow();
  await signIn(page, admin);
  await page.goto(`${AT}?action=e2e.client_update`);
  await expect(rowsOf(page)).toHaveCount(1);
  await page.reload();
  const action = page.getByRole('textbox', { name: 'Action', exact: true });
  await expect(action).toHaveValue('e2e.client_update');
  await expect(rowsOf(page)).toHaveCount(1);

  await action.fill('e2e.client_rotate');
  await apply(page);
  await expect(page).toHaveURL(/action=e2e\.client_rotate/u);
  await expect(rowsOf(page)).toHaveCount(1);
  await page.goBack();
  await expect(action).toHaveValue('e2e.client_update');
  await expect(rowsOf(page).first()).toContainText('e2e.client_update');
  await page.goForward();
  await expect(action).toHaveValue('e2e.client_rotate');

  await page.getByRole('button', { name: /Outcome/u }).click();
  await page.getByRole('option', { name: 'Allowed' }).click();
  await apply(page);
  await expect(page.getByRole('heading', { name: 'No event matches these filters' })).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Show every event' }).click();
  await expect(page).not.toHaveURL(/action=/u);
  await expect(trail(page)).toBeVisible();
});

test('a value in the address the trail cannot read is left out and said so', async ({ page }) => {
  await signIn(page, admin);
  await page.goto(`${AT}?outcome=maybe&actor_subject_id=grace&action=e2e.client_update`);
  await expect(page.getByText(/outcome the trail cannot read/u)).toBeVisible();
  await expect(page.getByText(/actor the trail cannot read/u)).toBeVisible();
  await expect(rowsOf(page)).toHaveCount(1);
  await expectAccessible(page);
});

test('a resource id waits for its type, an actor must be a UUID and a range must run forward', async ({
  page,
}) => {
  test.slow();
  await signIn(page, admin);
  await page.goto(AT);
  const type = page.getByRole('textbox', { name: 'Resource type', exact: true });
  const id = page.getByRole('textbox', { name: 'Resource id', exact: true });
  await expect(id).toBeDisabled();
  await type.fill('client');
  await expect(id).toBeEnabled();
  await id.fill(clientId);
  await apply(page);
  await expect(page).toHaveURL(new RegExp(`resource_id=${clientId}`, 'u'));
  await expect(rowsOf(page)).toHaveCount(2);
  await type.fill('');
  await expect(id).toBeDisabled();
  await expect(id).toHaveValue('');

  await page.getByRole('textbox', { name: 'Actor (subject id)' }).fill('grace');
  await apply(page);
  await expect(page.getByText(/A subject id is a UUID/u)).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('textbox', { name: 'Actor (subject id)' }).fill('');

  await typeDate(page, 'From', '2031-01-01T12:00');
  await typeDate(page, 'To', '2030-01-01T12:00');
  await apply(page);
  await expect(page.getByText(/To is before From/u)).toBeVisible();
  await expectAccessible(page);
  await typeDate(page, 'To', '2031-02-01T12:00');
  await apply(page);
  await expect(page).toHaveURL(/from=2031-01-01T/u);
  await expect(page.getByRole('heading', { name: 'No event matches these filters' })).toBeVisible();
  await expectAccessible(page);
});

test('rows of one request are labelled, a caller from elsewhere is marked, and a row opens in full', async ({
  page,
}) => {
  test.slow();
  await signIn(page, admin);
  await page.goto(`${AT}?resource_type=client&resource_id=${clientId}`);
  const rows = rowsOf(page);
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('request equest · 2 rows loaded');
  await expect(rows.nth(1)).toContainText('request equest · 2 rows loaded');
  await expect(page.getByText(/groups only the rows loaded here/u)).toBeVisible();
  await expectAccessible(page);

  await rows
    .first()
    .getByRole('button', { name: /^Details of/u })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Audit event' });
  await expect(dialog.getByText('true → false')).toBeVisible();
  await expect(dialog.getByText('before → after', { exact: false })).toBeVisible();
  const whole = dialog.getByRole('button', { name: 'Show the whole value of note' });
  await expect(dialog.getByText('long-value-'.repeat(40))).toHaveCount(0);
  await whole.click();
  await expect(dialog.getByText('long-value-'.repeat(40))).toBeVisible();
  await expectAccessible(page);
  await dialog.getByRole('link', { name: 'Open the client' }).click();
  await expect(page).toHaveURL(new RegExp(`/clients/${clientId}`, 'u'));
});

test('an actor of the tenant is named and links to its subject', async ({ page }) => {
  await signIn(page, admin);
  await page.goto(`${AT}?action=e2e.client_update`);
  const row = rowsOf(page).first();
  await row.getByRole('link', { name: `${admin.username}, open the subject` }).click();
  await expect(page).toHaveURL(new RegExp(`/${TENANT}/subjects/`, 'u'));
});

test('a cursor the trail no longer honours offers to start again', async ({ page, problems }) => {
  test.slow();
  await signIn(page, admin);
  await page.goto(`${AT}?action=e2e.bulk`);
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page).toHaveURL(/after=/u);
  const cursor = new URL(page.url()).searchParams.get('after') ?? '';
  expect(cursor).not.toBe('');
  await page.goto(`${AT}?action=e2e.client_update&after=${cursor}`);
  await expect(
    page.getByRole('heading', { name: 'This page of the trail has expired' }),
  ).toBeVisible();
  forgive(problems, `&cursor=${cursor}`);
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Start again' }).click();
  await expect(page).not.toHaveURL(/after=/u);
  await expect(rowsOf(page)).toHaveCount(1);
});

test('the trail is filtered and a row opened by keyboard alone', async ({ page }) => {
  test.slow();
  await signIn(page, admin);
  await page.goto(AT);
  await expect(trail(page)).toBeVisible();
  const action = page.getByRole('textbox', { name: 'Action', exact: true });
  await tabTo(page, action);
  await page.keyboard.type('e2e.client_update');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/action=e2e\.client_update/u);
  await expect(rowsOf(page)).toHaveCount(1);
  const details = page.getByRole('button', { name: 'Details of e2e.client_update' });
  await reachInGrid(page, details);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Audit event' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(details).toBeFocused();
  await expectAccessible(page);
});

test('the events the filters match are exported as a file, and the export is itself recorded', async ({
  page,
}) => {
  await signIn(page, admin);
  await page.goto(`${AT}?action=e2e.client_update`);
  await expect(rowsOf(page)).toHaveCount(1);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export these events' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^.+-audit-\d{4}-\d{2}-\d{2}\.ndjson$/u);
  const lines = readFileSync(await file.path(), 'utf8')
    .trim()
    .split('\n');
  expect(lines).toHaveLength(1);
  expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({ action: 'e2e.client_update' });
  await expect(page.getByText(/, 1 event\./u).first()).toBeVisible();
  await expectAccessible(page);
  await page.goto(`${AT}?action=audit.export`);
  await expect(rowsOf(page).first()).toBeVisible();
});

test('the audit trail fits a phone, with a row open', async ({ page }) => {
  test.slow();
  await page.setViewportSize(PHONE);
  await signIn(page, admin);
  await page.goto(`${AT}?action=e2e.client_update`);
  await expect(rowsOf(page)).toHaveCount(1);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expectFitsViewport(page, 'audit trail');
  await expectAccessible(page);
  await page.getByRole('button', { name: /^Details of/u }).click();
  await expect(page.getByRole('dialog', { name: 'Audit event' })).toBeVisible();
  await expectFitsViewport(page, 'audit event');
  await expectAccessible(page);
});

test('an operator holding view-audit alone reads the trail and no subject’s name', async ({
  page,
}) => {
  await signIn(page, viewer);
  await page.goto(`${AT}?action=e2e.client_update`);
  const row = rowsOf(page).first();
  await expect(row).toContainText('name not shown');
  await expect(row.getByRole('link', { name: /open the subject/u })).toHaveCount(0);
  await row.getByRole('button', { name: /^Details of/u }).click();
  await expect(page.getByRole('dialog', { name: 'Audit event' })).toContainText('holds view-users');
  await expectAccessible(page);
});

test('an operator holding view-users alone is told what the trail needs, and has no link to it', async ({
  page,
}) => {
  await signIn(page, usersOnly);
  await expect(page.getByRole('link', { name: 'Audit trail' })).toHaveCount(0);
  await page.goto(AT);
  await expect(page.getByRole('note').filter({ hasText: 'Audit trail needs' })).toHaveText(
    'Audit trail needs the view-audit capability.',
  );
  await expect(page.getByRole('search')).toHaveCount(0);
  await expectAccessible(page);
});

test('the system tenant’s own trail is the same page', async ({ page }) => {
  await signIn(page, system);
  await page.goto('/console/system/audit');
  await expect(page.getByRole('heading', { level: 1, name: 'Audit trail' })).toBeVisible();
  await expect(trail(page)).toBeVisible();
  await expectAccessible(page);
});

test('a system administrator’s action on the tenant is marked as from elsewhere, the product having written it', async ({
  page,
}) => {
  test.slow();
  await signIn(page, system);
  await page.goto(`/console/${TENANT}/registration-tokens`);
  await page.getByRole('button', { name: 'Mint token' }).click();
  const dialog = page.getByRole('dialog', { name: 'New registration token' });
  await takeSecret(dialog);
  await page.context().clearCookies();
  await signIn(page, admin);
  await page.goto(`${AT}?action=registration_token.mint`);
  const row = rowsOf(page).first();
  await expect(row).toContainText('from elsewhere');
  await expect(row).toContainText('a system administrator');
  await row.getByRole('button', { name: /^Details of/u }).click();
  await expect(page.getByRole('dialog', { name: 'Audit event' })).toContainText(
    'system administrator acting across tenants',
  );
  await expectAccessible(page);
});

test('another tenant’s administrator refused at this tenant is marked as from elsewhere', async ({
  page,
}) => {
  test.slow();
  await signIn(page, other);
  const refused = await page.request.get(`/console/api/admin/tenants/${TENANT}/whoami`);
  expect(refused.status()).toBeGreaterThanOrEqual(400);
  await page.context().clearCookies();
  await signIn(page, admin);
  await page.goto(`${AT}?action=token.foreign_issuer`);
  const row = rowsOf(page).first();
  await expect(row).toContainText('from elsewhere');
  await expect(row).toContainText('another tenant');
  await expectAccessible(page);
});

test.describe('a date no instant reads from', () => {
  test.use({ timezoneId: 'America/New_York' });

  test('a half-typed value is marked invalid, keeps its text, and holds Apply', async ({
    page,
  }) => {
    await signIn(page, admin);
    await page.goto(AT);
    const from = page.getByLabel('From', { exact: true });
    // The first segment, not the middle of an input wider than its segments.
    await from.click({ position: { x: 12, y: 20 } });
    await page.keyboard.type('09');
    await page.getByRole('textbox', { name: 'Action', exact: true }).click();
    await expect(from).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText(/not a complete date and time/u).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apply filters' })).toBeDisabled();
    await expect(page.getByText(/not narrowed by it until then/u)).toBeVisible();
    await expectAccessible(page);
    expect(new URL(page.url()).searchParams.has('from')).toBe(false);
  });

  test('Enter in a half-typed field holds the submit and marks it, with no blur before it', async ({
    page,
  }) => {
    await signIn(page, admin);
    await page.goto(AT);
    const from = page.getByLabel('From', { exact: true });
    await from.click({ position: { x: 12, y: 20 } });
    await page.keyboard.type('09');
    await page.keyboard.press('Enter');
    await expect(from).toHaveAttribute('aria-invalid', 'true');
    expect(new URL(page.url()).searchParams.has('from')).toBe(false);
  });

  test('the hour a spring-forward skips is refused, naming the zone, with the text kept', async ({
    page,
  }) => {
    await signIn(page, admin);
    await page.goto(AT);
    const from = page.getByLabel('From', { exact: true });
    await from.fill('2026-03-08T02:30');
    await expect(from).toHaveAttribute('aria-invalid', 'true');
    await expect(from).toHaveValue('2026-03-08T02:30');
    await expect(page.getByText(/does not exist in America\/New_York/u).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apply filters' })).toBeDisabled();
    await from.fill('2026-03-08T03:30');
    await expect(from).not.toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('button', { name: 'Apply filters' })).toBeEnabled();
  });
});
