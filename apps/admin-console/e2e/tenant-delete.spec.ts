import type { Page } from '@playwright/test';
import {
  expect,
  expectAccessible,
  expectFitsViewport,
  forgive,
  signIn,
  tabsWithin,
  test,
  PHONE,
} from './fixtures';
import { psql, seeded, sqlText } from './stack';

const { system, tenants } = seeded();
const { doomed } = tenants;

function exists(name: string): boolean {
  return psql(`select count(*) from tenants where name = ${sqlText(name)}`) === '1';
}

// The deletion is recorded where the administrators who can delete one are.
function recorded(name: string): string {
  return psql(
    `select count(*) from audit_events where tenant_id = (select id from tenants where name = 'system') and action = 'tenant.delete' and outcome = 'allowed' and detail ->> 'name' = ${sqlText(name)}`,
  );
}

async function open(page: Page, name: string): Promise<void> {
  await page.goto(`/console/system/tenants/${name}`);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(
    page
      .getByRole('button', { name: `Disable ${name}` })
      .or(page.getByRole('button', { name: `Enable ${name}` })),
  ).toBeVisible();
}

test('a tenant is disabled first, then deleted by typing its name, and is gone from the console and the database', async ({
  page,
  problems,
}) => {
  const name = doomed.main;
  await signIn(page, system);
  await open(page, name);
  const zone = page.getByRole('region', { name: 'Delete' });
  await expect(zone).toContainText(`Disable ${name} first`);
  await expect(page.getByRole('button', { name: `Delete ${name}` })).toHaveCount(0);
  await expectAccessible(page);

  await page.getByRole('button', { name: `Disable ${name}` }).click();
  const disable = page.getByRole('alertdialog', { name: `Disable ${name}?` });
  await disable.getByRole('textbox').fill(name);
  await disable.getByRole('button', { name: `Disable ${name}` }).click();
  await expect(page.getByRole('button', { name: `Enable ${name}` })).toBeVisible();
  await expect(zone).not.toContainText('first');
  await expectAccessible(page);

  await zone.getByRole('button', { name: `Delete ${name}` }).click();
  const dialog = page.getByRole('alertdialog', { name: `Delete ${name}?` });
  await expect(dialog).toContainText('its audit trail');
  await expect(dialog).toContainText('This cannot be undone');
  const confirm = dialog.getByRole('button', { name: `Delete ${name}` });
  await expect(confirm).toBeDisabled();
  await expectAccessible(page);
  await dialog.getByRole('textbox').fill('delete');
  await expect(confirm).toBeDisabled();
  await dialog.getByRole('textbox').fill(name);
  await confirm.click();

  await expect(page).toHaveURL('/console/system/tenants');
  await expect(page.getByText(`${name} was deleted.`)).toBeVisible();
  const list = page.getByRole('grid', { name: 'Tenants' });
  await expect(list).toBeVisible();
  await expect(list.getByRole('row', { name: new RegExp(name, 'u') })).toHaveCount(0);
  expect(exists(name)).toBe(false);
  expect(recorded(name)).toBe('1');
  await expectAccessible(page);

  await page.goto(`/console/system/tenants/${name}`);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'No such tenant' })).toBeVisible();
  forgive(problems, `/admin/tenants/${name}`);
  await expect(page.getByRole('button', { name: /^Delete /u })).toHaveCount(0);
  await expectAccessible(page);
});

test('a tenant is deleted by keyboard alone, from the Delete button to the typed name', async ({
  page,
}) => {
  const name = doomed.keyed;
  await signIn(page, system);
  await open(page, name);
  const button = page.getByRole('button', { name: `Delete ${name}` });
  await tabsWithin(60)(page, button);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('alertdialog', { name: `Delete ${name}?` });
  await expect(dialog.getByRole('textbox')).toBeFocused();
  await page.keyboard.type(name);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/console/system/tenants');
  await expect(page.getByText(`${name} was deleted.`)).toBeVisible();
  expect(exists(name)).toBe(false);
  await expectAccessible(page);
});

test('a delete the server refuses is said beside the action, and the tenant stays', async ({
  page,
  problems,
}) => {
  const name = doomed.raced;
  await signIn(page, system);
  await open(page, name);
  await expect(page.getByRole('button', { name: `Delete ${name}` })).toBeVisible();
  // Enabled again behind the open page, which still shows it disabled.
  psql(`update tenants set enabled = true where name = ${sqlText(name)}`);
  await page.getByRole('button', { name: `Delete ${name}` }).click();
  const dialog = page.getByRole('alertdialog', { name: `Delete ${name}?` });
  await dialog.getByRole('textbox').fill(name);
  await dialog.getByRole('button', { name: `Delete ${name}` }).click();
  await expect(dialog.getByRole('alert')).toContainText(`${name} was enabled again`);
  await expect(dialog.getByRole('alert')).toContainText(`Disable ${name} first`);
  await expectAccessible(page);
  expect(exists(name)).toBe(true);
  forgive(problems, `/admin/tenants/${name}?confirm=${name}`);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
});

test('the system tenant is shown as one that is never deleted', async ({ page }) => {
  await signIn(page, system);
  await page.goto('/console/system/tenants/system');
  await expect(page.getByRole('heading', { level: 1, name: 'system' })).toBeVisible();
  await expect(page.getByText(/system cannot be deleted/u)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Delete /u })).toHaveCount(0);
  await expectAccessible(page);
});

test('the delete confirmation fits a phone', async ({ page }) => {
  const name = doomed.phone;
  await page.setViewportSize(PHONE);
  await signIn(page, system);
  await open(page, name);
  await expectFitsViewport(page, 'tenant record');
  await page.getByRole('button', { name: `Delete ${name}` }).click();
  const dialog = page.getByRole('alertdialog', { name: `Delete ${name}?` });
  await expect(dialog).toBeVisible();
  await expectFitsViewport(page, 'delete dialog');
  await expectAccessible(page);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(exists(name)).toBe(true);
});
