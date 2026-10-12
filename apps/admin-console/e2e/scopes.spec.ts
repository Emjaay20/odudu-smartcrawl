import type { Locator, Page } from '@playwright/test';
import { expect, expectAccessible, expectFitsViewport, forgive, signIn, test } from './fixtures';
import { psql, seeded } from './stack';

const { admin, tenantOnly, clientsOnly } = seeded().scopes;
const TENANT = admin.tenant;
const UNBROKEN = 'segment'.repeat(8);
const PHONE = { width: 390, height: 844 };

function sqlText(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

const IN_TENANT = `(select id from tenants where name = ${sqlText(TENANT)})`;

function scopeId(name: string): string {
  return psql(
    `select id from client_scopes where tenant_id = ${IN_TENANT} and name = ${sqlText(name)}`,
  );
}

function scopeField(name: string, column: string): string {
  return psql(
    `select coalesce(${column}::text, '<null>') from client_scopes where tenant_id = ${IN_TENANT} and name = ${sqlText(name)}`,
  );
}

function mappedRoles(name: string): string {
  return psql(
    `select coalesce(string_agg(r.name, ',' order by r.name), '') from client_scope_roles sr join roles r on r.id = sr.role_id where sr.client_scope_id = '${scopeId(name)}'`,
  );
}

function boundMappers(name: string): string {
  return psql(
    `select coalesce(string_agg(mapper_name, ',' order by mapper_name), '') from client_scope_mappers where client_scope_id = '${scopeId(name)}'`,
  );
}

// Each client carrying the scope, as `client_id:assignment`.
function carriers(name: string): string {
  return psql(
    `select coalesce(string_agg(c.client_id || ':' || a.assignment, ',' order by c.client_id), '') from client_scope_assignments a join clients c on c.id = a.client_id where a.client_scope_id = '${scopeId(name)}'`,
  );
}

function clientConfig(clientKey: string, column: string): string {
  return psql(
    `select coalesce(${column}::text, '<null>') from client_oidc_config where client_id = (select id from clients where tenant_id = ${IN_TENANT} and client_id = ${sqlText(clientKey)})`,
  );
}

// Moves focus with Tab alone until it lands on `target`.
async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let pressed = 0; pressed < 120; pressed += 1) {
    if (await target.evaluate((node) => node === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

async function openScope(page: Page, name: string, tab = 'general'): Promise<void> {
  await page.goto(`/console/${TENANT}/scopes/${scopeId(name)}?tab=${tab}`);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

test('a scope is made, described, given a role and a mapper, and read back from the database', async ({
  page,
}) => {
  // Seven pages checked for accessibility under four themes each: more than one test's budget.
  test.slow();
  await signIn(page, admin);
  await page.goto(`/console/${TENANT}/scopes`);
  const table = page.getByRole('grid', { name: 'Scopes' });
  await expect(table.getByRole('row', { name: /invoices/u })).toContainText('The invoices scope');
  await expectAccessible(page);

  await page.getByRole('link', { name: 'Create a scope' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('statements');
  await page.getByRole('textbox', { name: 'Description' }).fill('Reads statements');
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Create scope' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'statements' })).toBeVisible();
  await expect.poll(() => scopeField('statements', 'description')).toBe('Reads statements');

  const description = page.getByRole('region', { name: 'Description' });
  await description.getByRole('textbox', { name: 'Description' }).fill('Statements, read-only');
  await description.getByRole('button', { name: 'Save Description' }).click();
  await expect.poll(() => scopeField('statements', 'description')).toBe('Statements, read-only');

  const tokens = page.getByRole('region', { name: 'Tokens' });
  // A scope made without the flag carries its claims in the ID token; this turns that off.
  await expect.poll(() => scopeField('statements', 'include_in_id_token')).toBe('true');
  await tokens.getByText('In the ID token', { exact: true }).click();
  await tokens.getByRole('button', { name: 'Save Tokens' }).click();
  await expect.poll(() => scopeField('statements', 'include_in_id_token')).toBe('false');

  const consent = page.getByRole('region', { name: 'Consent' });
  await consent.getByRole('textbox', { name: 'Consent text' }).fill('Read your statements');
  await consent.getByRole('textbox', { name: 'Display order' }).fill('7');
  await consent.getByRole('button', { name: 'Save Consent' }).click();
  await expect.poll(() => scopeField('statements', 'consent_text')).toBe('Read your statements');
  await expect.poll(() => scopeField('statements', 'display_order')).toBe('7');
  await expectAccessible(page);

  await page.getByRole('tab', { name: 'Roles' }).click();
  const roles = page.getByRole('region', { name: 'Roles' });
  await roles
    .getByRole('listbox', { name: 'Roles statements carries' })
    .getByRole('option', { name: 'auditor, a tenant role' })
    .click();
  await roles.getByRole('button', { name: 'Save Roles' }).click();
  await expect(roles.getByRole('list', { name: 'Carried by statements' })).toContainText('auditor');
  await expect.poll(() => mappedRoles('statements')).toBe('auditor');
  await expectAccessible(page);

  await page.getByRole('tab', { name: 'Claim mappers' }).click();
  const mappers = page.getByRole('region', { name: 'Claim mappers' });
  await expect(mappers.getByText(/none declares it/u)).toBeVisible();
  await mappers.getByText('email', { exact: true }).click();
  await mappers.getByText('groups', { exact: true }).click();
  await mappers.getByRole('button', { name: 'Save Claim mappers' }).click();
  await expect(mappers.getByText('Bound: email and groups.')).toBeVisible();
  await expect.poll(() => boundMappers('statements')).toBe('email,groups');
  await expectAccessible(page);

  await page.getByRole('tab', { name: 'Activity' }).click();
  const trail = page.getByRole('grid', { name: 'Activity on this scope' });
  await expect(trail).toContainText('scope.roles_set');
  await expect(trail).toContainText('scope.mappers_set');
  await expectAccessible(page);
});

test('the clients carrying a scope are listed, assigned by a server search, changed and unassigned', async ({
  page,
}) => {
  await signIn(page, admin);
  await openScope(page, 'carried', 'clients');
  const carrying = page.getByRole('region', { name: 'Clients carrying carried' });
  const list = carrying.getByRole('list', { name: 'Clients carrying carried' });
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect(list.getByRole('listitem').filter({ hasText: 'billing' })).toContainText('Default');
  await expect(list.getByRole('listitem').filter({ hasText: 'portal' })).toContainText('Optional');
  await expectAccessible(page);

  await openScope(page, 'invoices', 'clients');
  await expect(page.getByText('No client carries invoices.')).toBeVisible();
  const assign = page.getByRole('region', { name: 'Assign to a client' });
  await assign.getByRole('searchbox', { name: 'Search clients by name' }).fill('por');
  await assign.getByRole('button', { name: 'Search' }).click();
  const choices = assign.getByRole('listbox', { name: 'Client to assign' });
  await expect(choices.getByRole('option')).toHaveCount(1);
  await choices.getByRole('option', { name: /portal/u }).click();
  await assign.getByRole('button', { name: 'Assign to portal' }).click();
  const carried = page.getByRole('list', { name: 'Clients carrying invoices' });
  await expect(carried).toContainText('portal');
  await expect.poll(() => carriers('invoices')).toBe('portal:default');
  await expectAccessible(page);

  const row = carried.getByRole('listitem').filter({ hasText: 'portal' });
  await row.getByRole('button', { name: /Assignment for portal/u }).click();
  await page.getByRole('option', { name: 'Optional' }).click();
  await expect.poll(() => carriers('invoices')).toBe('portal:optional');
  await row.getByRole('button', { name: 'Unassign portal' }).click();
  await expect(page.getByText('No client carries invoices.')).toBeVisible();
  await expect.poll(() => carriers('invoices')).toBe('');
  await expectAccessible(page);
});

test("a client's page still saves after a scope was assigned to it from the scope's page", async ({
  page,
}) => {
  await signIn(page, admin);
  const client = psql(
    `select id from clients where tenant_id = ${IN_TENANT} and client_id = 'billing'`,
  );
  await page.goto(`/console/${TENANT}/clients/${client}?tab=scopes`);
  await expect(page.getByRole('region', { name: 'Assigned scopes' })).toBeVisible();

  // Through the rail, so the client the console already holds is not read afresh by a reload.
  await page.getByRole('link', { name: 'Scopes', exact: true }).first().click();
  await page
    .getByRole('grid', { name: 'Scopes' })
    .getByRole('row', { name: /staffed/u })
    .click();
  await page.getByRole('tab', { name: 'Clients' }).click();
  const assign = page.getByRole('region', { name: 'Assign to a client' });
  await assign.getByRole('searchbox', { name: 'Search clients by name' }).fill('bil');
  await assign.getByRole('button', { name: 'Search' }).click();
  await assign
    .getByRole('listbox', { name: 'Client to assign' })
    .getByRole('option', { name: /billing/u })
    .click();
  await assign.getByRole('button', { name: 'Assign to billing' }).click();
  await expect.poll(() => carriers('staffed')).toBe('billing:default');

  await page.getByRole('link', { name: 'Clients', exact: true }).first().click();
  await page
    .getByRole('grid', { name: 'Clients' })
    .getByRole('row', { name: /billing/u })
    .click();
  await page.getByRole('tab', { name: 'Tokens' }).click();
  const lifetimes = page.getByRole('region', { name: 'Token lifetimes' });
  await lifetimes.getByText("Use the tenant's refresh token lifetime", { exact: true }).click();
  await lifetimes.getByRole('button', { name: 'Save Token lifetimes' }).click();
  await expect.poll(() => clientConfig('billing', 'refresh_token_ttl_seconds')).toBe('86400');
  await expect(page.getByText(/changed elsewhere/u)).toHaveCount(0);
});

test('a description changed behind an open page is shown beside yours, and nothing merges', async ({
  page,
  problems,
}) => {
  await signIn(page, admin);
  await openScope(page, 'raced');
  const section = page.getByRole('region', { name: 'Description' });
  await section.getByRole('textbox', { name: 'Description' }).fill('Mine');
  psql(
    `update client_scopes set description = 'Theirs' where tenant_id = ${IN_TENANT} and name = 'raced'`,
  );
  await section.getByRole('button', { name: 'Save Description' }).click();
  await expect(section.getByText(/changed elsewhere/u).first()).toBeVisible();
  await expect(section.getByRole('button', { name: 'Keep mine in Description' })).toBeVisible();
  await expectAccessible(page);
  forgive(problems, `/scopes/${scopeId('raced')}`);
  await expect.poll(() => scopeField('raced', 'description')).toBe('Theirs');
});

test('a scope is copied under a new name, with its roles and mappers, and not its clients', async ({
  page,
}) => {
  await signIn(page, admin);
  await openScope(page, 'staffed');
  await page.getByRole('link', { name: 'Create a copy' }).click();
  await expect(
    page.getByText('A copy of staffed, mapping auditor and binding no mapper.'),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Description' })).toHaveValue('The staffed scope');
  await expectAccessible(page);
  await page.getByRole('textbox', { name: 'Name' }).fill('staffed-copy');
  await page.getByRole('button', { name: 'Create scope' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'staffed-copy' })).toBeVisible();
  await expect.poll(() => mappedRoles('staffed-copy')).toBe('auditor');
  expect(carriers('staffed-copy')).toBe('');
});

test('openid is shown with its refusal as fixed text and no delete to press', async ({ page }) => {
  await signIn(page, admin);
  await openScope(page, 'openid');
  await expect(page.getByText(/openid cannot be deleted/u)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Delete/u })).toHaveCount(0);
  await expectAccessible(page);
  expect(scopeField('openid', 'name')).toBe('openid');
});

test('a scope is deleted once its name is typed, and goes from the list', async ({ page }) => {
  await signIn(page, admin);
  await openScope(page, 'doomed');
  await page.getByRole('button', { name: 'Delete doomed' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Delete doomed?' });
  await expect(dialog).toContainText('takes it off every client assigned doomed');
  await expectAccessible(page);
  await expect(dialog.getByRole('button', { name: 'Delete doomed' })).toBeDisabled();
  await dialog.getByRole('textbox').fill('doomed');
  await dialog.getByRole('button', { name: 'Delete doomed' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Scopes' })).toBeVisible();
  expect(
    psql(`select count(*) from client_scopes where tenant_id = ${IN_TENANT} and name = 'doomed'`),
  ).toBe('0');
});

test("a scope's description and mappers are changed by keyboard alone, from the list", async ({
  page,
}) => {
  await signIn(page, admin);
  await page.goto(`/console/${TENANT}/scopes`);
  const search = page.getByRole('searchbox', { name: /Search/u });
  await tabTo(page, search);
  await page.keyboard.type('keyed');
  await page.keyboard.press('Enter');
  const grid = page.getByRole('grid', { name: 'Scopes' });
  await expect(grid.getByRole('row', { name: /keyed/u })).toBeVisible();
  for (let pressed = 0; pressed < 30; pressed += 1) {
    if ((await grid.locator(':focus').count()) > 0) break;
    await page.keyboard.press('Tab');
  }
  await expect(grid.locator(':focus')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'keyed' })).toBeVisible();
  const field = page.getByRole('textbox', { name: 'Description' });
  await tabTo(page, field);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Typed by keyboard');
  const save = page.getByRole('button', { name: 'Save Description' });
  await tabTo(page, save);
  await page.keyboard.press('Enter');
  await expect(save).toBeHidden();
  await expect.poll(() => scopeField('keyed', 'description')).toBe('Typed by keyboard');

  await page.getByRole('tab', { name: 'Claim mappers' }).focus();
  await page.keyboard.press('Enter');
  const email = page.getByRole('checkbox', { name: 'email' });
  await tabTo(page, email);
  await page.keyboard.press('Space');
  const saveMappers = page.getByRole('button', { name: 'Save Claim mappers' });
  await tabTo(page, saveMappers);
  await page.keyboard.press('Enter');
  await expect(saveMappers).toBeHidden();
  await expect.poll(() => boundMappers('keyed')).toBe('email');
  await expectAccessible(page);
});

test('an operator holding manage-tenant alone chooses no role it lacks, and is told it may not search clients', async ({
  page,
}) => {
  await signIn(page, tenantOnly);
  await openScope(page, 'staffed', 'roles');
  const options = page.getByRole('listbox', { name: 'Roles staffed carries' });
  await expect(options.getByRole('option', { name: 'helper, a tenant role' })).toContainText(
    'It reaches view-users, which you do not hold, so you cannot give or take it.',
  );
  await expect(options.getByRole('option', { name: 'helper, a tenant role' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await expectAccessible(page);

  await page.getByRole('tab', { name: 'Clients' }).click();
  await expect(page.getByRole('list', { name: 'Clients carrying staffed' })).toBeVisible();
  await expect(page.getByRole('note').filter({ hasText: 'Choosing a client' })).toHaveText(
    'Choosing a client to assign needs the manage-clients capability.',
  );
  await expect(page.getByRole('region', { name: 'Assign to a client' })).toHaveCount(0);
  await expectAccessible(page);
});

test('an operator holding manage-clients alone is told what the scopes need', async ({
  page,
  problems,
}) => {
  await signIn(page, clientsOnly);
  await page.goto(`/console/${TENANT}/scopes`);
  await expect(page.getByRole('note').filter({ hasText: 'Scopes needs the' })).toHaveText(
    'Scopes needs the manage-tenant capability.',
  );
  await expectAccessible(page);
  // The list is asked for while whoami is still answering, and refused.
  forgive(problems, `/tenants/${TENANT}/scopes`);
  forgive(problems, `/tenants/${TENANT}/scopes/count`);
});

test('the scopes pages fit a phone, with a scope whose name is wider than the screen', async ({
  page,
}) => {
  test.slow();
  await page.setViewportSize(PHONE);
  await signIn(page, admin);
  const pages = [
    `/console/${TENANT}/scopes`,
    `/console/${TENANT}/scopes/new`,
    `/console/${TENANT}/scopes/${scopeId('carried')}`,
    `/console/${TENANT}/scopes/${scopeId('carried')}?tab=roles`,
    `/console/${TENANT}/scopes/${scopeId('carried')}?tab=mappers`,
    `/console/${TENANT}/scopes/${scopeId('carried')}?tab=clients`,
    `/console/${TENANT}/scopes/${scopeId(UNBROKEN)}`,
    `/console/${TENANT}/scopes/${scopeId(UNBROKEN)}?tab=clients`,
  ];
  for (const address of pages) {
    await page.goto(address);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveCount(0);
    await expect(page.locator('[role="status"]', { hasText: /^Loading/u })).toHaveCount(0);
    await expect(page.getByText(/^Checking /u)).toHaveCount(0);
    await expectFitsViewport(page, address);
    await expectAccessible(page);
  }
});
