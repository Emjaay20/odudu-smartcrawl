import type { Locator, Page } from '@playwright/test';
import { expect, expectAccessible, expectFitsViewport, forgive, signIn, test } from './fixtures';
import { psql, seeded } from './stack';

const { email } = seeded().config;
const PHONE = { width: 390, height: 844 };

function relayOf(tenant: string, expression: string): string {
  return psql(
    `select ${expression} from tenant_smtp where tenant_id = (select id from tenants where name = '${tenant}')`,
  );
}

async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let pressed = 0; pressed < 80; pressed += 1) {
    if (await target.evaluate((node) => node === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

// Everything the page keeps in the browser, as text.
function browserStorage(page: Page): Promise<string> {
  return page.evaluate(() =>
    JSON.stringify([...Object.entries(sessionStorage), ...Object.entries(localStorage)]),
  );
}

async function openEmail(page: Page, tenant: string): Promise<Locator> {
  await page.goto(`/console/${tenant}/email`);
  await expect(page.getByRole('heading', { level: 1, name: 'Email' })).toBeVisible();
  const form = page.getByRole('region', { name: 'Mail relay', exact: true });
  await expect(form).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  return form;
}

async function fillRelay(form: Locator, host: string): Promise<void> {
  await form.getByRole('textbox', { name: 'Host' }).fill(host);
  await form.getByRole('textbox', { name: 'Sender address' }).fill('noreply@example.test');
  await form.getByRole('textbox', { name: 'Username' }).fill('mailer');
  await form.getByLabel('New password').fill('first-secret');
}

test('a relay is set, its password kept, replaced and cleared, and never shown', async ({
  page,
  problems,
}) => {
  test.slow();
  const { main } = email;
  await signIn(page, main);
  const form = await openEmail(page, main.tenant);
  await expect(page.getByText(/only written to the server’s log/u)).toBeVisible();
  await expect(form.getByRole('button', { name: 'Save Mail relay' })).toBeHidden();
  await expectAccessible(page);

  await fillRelay(form, 'smtp.example.test');
  await expect(form.getByText(/Leave it empty if the relay needs none/u)).toBeVisible();
  await form.getByRole('button', { name: 'Save Mail relay' }).click();
  await expect(form.getByRole('button', { name: 'Save Mail relay' })).toBeHidden();
  await expect.poll(() => relayOf(main.tenant, 'host')).toBe('smtp.example.test');
  expect(relayOf(main.tenant, 'password_encrypted is not null')).toBe('t');
  await expect(page.getByText(/sends its mail through its own relay/u)).toBeVisible();
  await expect(form.getByLabel('New password')).toHaveValue('');
  await expect(form.getByText(/A password is stored and never shown/u)).toBeVisible();
  expect(await browserStorage(page)).not.toContain('first-secret');
  await expectAccessible(page);
  const stored = relayOf(main.tenant, 'password_encrypted');

  await form.getByRole('textbox', { name: 'Sender address' }).fill('ops@example.test');
  await form.getByRole('button', { name: 'Save Mail relay' }).click();
  await expect.poll(() => relayOf(main.tenant, 'from_address')).toBe('ops@example.test');
  expect(relayOf(main.tenant, 'password_encrypted')).toBe(stored);

  await form.getByRole('textbox', { name: 'Host' }).fill('other.example.test');
  await expect(form.getByText(/only kept for the host, port and username/u)).toBeVisible();
  await expectAccessible(page);
  await form.getByRole('button', { name: 'Save Mail relay' }).click();
  await expect(
    form.getByText('must be sent again when host, port or username changes'),
  ).toBeVisible();
  await expectAccessible(page);
  forgive(problems, `/tenants/${main.tenant}/smtp`);
  expect(relayOf(main.tenant, 'host')).toBe('smtp.example.test');

  await form.getByLabel('New password').fill('second-secret');
  await form.getByRole('button', { name: 'Save Mail relay' }).click();
  await expect.poll(() => relayOf(main.tenant, 'host')).toBe('other.example.test');
  expect(relayOf(main.tenant, 'password_encrypted')).not.toBe(stored);
  await expect(form.getByLabel('New password')).toHaveValue('');
  expect(await browserStorage(page)).not.toContain('second-secret');

  await form.getByText('Remove the stored password', { exact: true }).click();
  await expect(form.getByLabel('New password')).toBeDisabled();
  await expectAccessible(page);
  await form.getByRole('button', { name: 'Save Mail relay' }).click();
  await expect.poll(() => relayOf(main.tenant, 'password_encrypted is null')).toBe('t');
  await expect(form.getByText(/Leave it empty if the relay needs none/u)).toBeVisible();
  expect(relayOf(main.tenant, 'host')).toBe('other.example.test');
});

test('a test message to a relay this server will not connect to says the server’s reason', async ({
  page,
  problems,
}) => {
  test.slow();
  const { refused } = email;
  await signIn(page, refused);
  const form = await openEmail(page, refused.tenant);
  const test_ = page.getByRole('region', { name: 'Test message' });
  await expect(test_.getByRole('button', { name: 'Send test message' })).toBeDisabled();
  await expect(test_.getByText(/Save a relay of this tenant’s own first/u)).toBeVisible();

  await form.getByRole('textbox', { name: 'Host' }).fill('127.0.0.1');
  await form.getByRole('textbox', { name: 'Sender address' }).fill('noreply@example.test');
  await form.getByRole('button', { name: 'Save Mail relay' }).click();
  await expect.poll(() => relayOf(refused.tenant, 'host')).toBe('127.0.0.1');

  await test_.getByRole('textbox', { name: 'Send to' }).fill('someone@example.test');
  await test_.getByRole('button', { name: 'Send test message' }).click();
  await expect(test_.getByRole('status')).toContainText(
    'Not sent. The server said: this server will not connect to 127.0.0.1',
  );
  await expectAccessible(page);
  forgive(problems, `/tenants/${refused.tenant}/smtp/test`);
});

test('the relay is removed after asking, and the page says nothing sends the mail', async ({
  page,
}) => {
  test.slow();
  const { removal } = email;
  await signIn(page, removal);
  const form = await openEmail(page, removal.tenant);
  await fillRelay(form, 'smtp.example.test');
  await form.getByRole('button', { name: 'Save Mail relay' }).click();
  await expect.poll(() => relayOf(removal.tenant, 'host')).toBe('smtp.example.test');

  const zone = page.getByRole('region', { name: 'Remove the relay' });
  await zone.getByRole('button', { name: 'Remove the relay' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Remove this tenant’s relay?' });
  await expect(dialog).toContainText('deployment’s sender');
  await expectAccessible(page);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(relayOf(removal.tenant, 'host')).toBe('smtp.example.test');
  await zone.getByRole('button', { name: 'Remove the relay' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remove the relay' }).click();
  await expect.poll(() => relayOf(removal.tenant, 'count(*)')).toBe('0');
  await expect(page.getByText(/only written to the server’s log/u)).toBeVisible();
  await expect(zone).toBeHidden();
  await expectAccessible(page);
});

test('a relay is filled in and saved by keyboard alone', async ({ page }) => {
  test.slow();
  const { keyed } = email;
  await signIn(page, keyed);
  const form = await openEmail(page, keyed.tenant);
  await tabTo(page, form.getByRole('textbox', { name: 'Host' }));
  await page.keyboard.type('smtp.example.test');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.type('noreply@example.test');
  await expect(form.getByRole('textbox', { name: 'Sender address' })).toBeFocused();
  const save = form.getByRole('button', { name: 'Save Mail relay' });
  await tabTo(page, save);
  await page.keyboard.press('Enter');
  await expect.poll(() => relayOf(keyed.tenant, 'from_address')).toBe('noreply@example.test');
  await expectAccessible(page);
});

test('an operator holding manage-clients alone is told what Email needs, and has no link to it', async ({
  page,
}) => {
  const { fixed, fixedClientsOnly } = email;
  await signIn(page, fixedClientsOnly);
  await page.goto(`/console/${fixed.tenant}/email`);
  await expect(page.getByRole('note').filter({ hasText: 'Email needs' })).toHaveText(
    'Email needs the manage-tenant capability.',
  );
  await expect(page.getByRole('link', { name: 'Email', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Save / })).toHaveCount(0);
  await expectAccessible(page);
});

test('the email page fits a phone', async ({ page }) => {
  test.slow();
  await page.setViewportSize(PHONE);
  await signIn(page, email.fixed);
  await openEmail(page, email.fixed.tenant);
  await expectFitsViewport(page, 'email');
  await expectAccessible(page);
});
