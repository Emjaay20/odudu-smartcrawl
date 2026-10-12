import type { Locator, Page } from '@playwright/test';
import { expect, expectAccessible, expectFitsViewport, forgive, signIn, test } from './fixtures';
import { psql, seeded } from './stack';

const { flows } = seeded().access;
const PHONE = { width: 390, height: 844 };

function flowOf(tenant: string): string {
  return psql(
    `select string_agg(authenticator || ':' || requirement, ',' order by index) from authentication_executions where tenant_id = (select id from tenants where name = '${tenant}')`,
  );
}

function otpRequired(tenant: string): string {
  return psql(`select otp_required from tenants where name = '${tenant}'`);
}

async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let pressed = 0; pressed < 150; pressed += 1) {
    if (await target.evaluate((node) => node === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

async function openFlow(page: Page, tenant: string): Promise<Locator> {
  await page.goto(`/console/${tenant}/flow`);
  await expect(page.getByRole('heading', { level: 1, name: 'Sign-in flow' })).toBeVisible();
  const section = page.getByRole('region', { name: 'Steps' });
  await expect(section.getByRole('list', { name: 'Sign-in steps' })).toBeVisible();
  return section;
}

async function order(section: Locator): Promise<string[]> {
  return section.getByRole('list', { name: 'Sign-in steps' }).locator('li code').allInnerTexts();
}

test('the flow is reordered, a step disabled and one added, and the one-time password asked of everyone', async ({
  page,
}) => {
  test.slow();
  const { main } = flows;
  await signIn(page, main);
  const section = await openFlow(page, main.tenant);
  expect(await order(section)).toEqual(['passkey', 'password', 'otp']);
  await expectAccessible(page);

  await section.getByRole('button', { name: 'Move password up' }).click();
  await section.getByRole('button', { name: /Requirement for otp/u }).click();
  await page.getByRole('option', { name: 'Disabled' }).click();
  await section.getByRole('button', { name: 'Add step' }).click();
  expect(await order(section)).toEqual(['password', 'passkey', 'otp', 'recovery-code']);
  await expectAccessible(page);
  await section.getByRole('button', { name: 'Save Steps' }).click();
  await expect(section.getByRole('button', { name: 'Save Steps' })).toBeHidden();
  expect(flowOf(main.tenant)).toBe(
    'password:alternative,passkey:alternative,otp:disabled,recovery-code:conditional',
  );

  const otp = page.getByRole('region', { name: 'One-time password' });
  await expect(
    section.getByText('Asked only of subjects who set up an authenticator app.'),
  ).toBeVisible();
  await otp.getByText('Ask every subject for a one-time password', { exact: true }).click();
  await otp.getByRole('button', { name: 'Save One-time password' }).click();
  await expect(otp.getByRole('button', { name: 'Save One-time password' })).toBeHidden();
  expect(otpRequired(main.tenant)).toBe('t');
  await expect(section.getByText('Asked of every subject.')).toBeVisible();
  await expectAccessible(page);

  await page.reload();
  expect(await order(await openFlow(page, main.tenant))).toEqual([
    'password',
    'passkey',
    'otp',
    'recovery-code',
  ]);
});

test('a flow changed behind the open page is shown as changed, and nothing is overwritten', async ({
  page,
  problems,
}) => {
  const { conflict } = flows;
  await signIn(page, conflict);
  const section = await openFlow(page, conflict.tenant);
  await section.getByRole('button', { name: 'Move password up' }).click();
  psql(
    `update authentication_executions set requirement = 'required' where authenticator = 'otp' and tenant_id = (select id from tenants where name = '${conflict.tenant}')`,
  );
  await section.getByRole('button', { name: 'Save Steps' }).click();
  await expect(section.getByText(/changed elsewhere/u).first()).toBeVisible();
  await expectAccessible(page);
  forgive(problems, `/tenants/${conflict.tenant}/flow/executions`);
  expect(flowOf(conflict.tenant)).toBe(
    'passkey:alternative,password:alternative,otp:required,recovery-code:conditional',
  );
});

test('the server refuses a flow nobody could sign in with, and says so beside Save', async ({
  page,
  problems,
}) => {
  test.slow();
  const { refused } = flows;
  await signIn(page, refused);
  const section = await openFlow(page, refused.tenant);
  const before = flowOf(refused.tenant);

  await section.getByRole('button', { name: /Requirement for passkey/u }).click();
  await page.getByRole('option', { name: 'Required' }).click();
  await section.getByRole('button', { name: 'Save Steps' }).click();
  await expect(section.getByRole('alert')).toContainText('only the password step can run');
  await expectAccessible(page);
  await section.getByRole('button', { name: 'Discard changes to Steps' }).click();

  for (const step of ['passkey', 'password', 'otp', 'recovery-code']) {
    await section.getByRole('button', { name: new RegExp(`Requirement for ${step}`, 'u') }).click();
    await page.getByRole('option', { name: 'Disabled' }).click();
  }
  await section.getByRole('button', { name: 'Save Steps' }).click();
  await expect(section.getByRole('alert')).toContainText('Every step is disabled');
  await expectAccessible(page);
  expect(flowOf(refused.tenant)).toBe(before);
  forgive(problems, `/tenants/${refused.tenant}/flow/executions`);
});

test('a step is moved and the flow saved by keyboard alone, the focus following the step', async ({
  page,
}) => {
  const { keyed } = flows;
  await signIn(page, keyed);
  const section = await openFlow(page, keyed.tenant);
  const up = section.getByRole('button', { name: 'Move password up' });
  await tabTo(page, up);
  await page.keyboard.press('Enter');
  await expect(section.getByRole('button', { name: 'Move password down' })).toBeFocused();
  expect(await order(section)).toEqual(['password', 'passkey', 'otp']);
  const save = section.getByRole('button', { name: 'Save Steps' });
  await tabTo(page, save);
  await page.keyboard.press('Enter');
  await expect(save).toBeHidden();
  expect(flowOf(keyed.tenant)).toBe('password:alternative,passkey:alternative,otp:conditional');

  const toggle = page
    .getByRole('region', { name: 'One-time password' })
    .getByRole('switch', { name: /Ask every subject/u });
  await tabTo(page, toggle);
  await page.keyboard.press('Space');
  const saveOtp = page.getByRole('button', { name: 'Save One-time password' });
  await tabTo(page, saveOtp);
  await page.keyboard.press('Enter');
  await expect(saveOtp).toBeHidden();
  expect(otpRequired(keyed.tenant)).toBe('t');
  await expectAccessible(page);
});

test('an operator holding manage-tenant alone edits the flow', async ({ page }) => {
  await signIn(page, flows.fixedTenantOnly);
  const section = await openFlow(page, flows.fixed.tenant);
  await expect(section.getByRole('button', { name: 'Move password up' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign-in flow' })).toBeVisible();
  await expectAccessible(page);
});

test('an operator holding manage-clients alone is told what the flow needs, and has no link to it', async ({
  page,
  problems,
}) => {
  await signIn(page, flows.fixedClientsOnly);
  await page.goto(`/console/${flows.fixed.tenant}/flow`);
  await expect(page.getByRole('note').filter({ hasText: 'Sign-in flow needs' })).toHaveText(
    'Sign-in flow needs the manage-tenant capability.',
  );
  await expect(page.getByRole('link', { name: 'Sign-in flow' })).toHaveCount(0);
  await expectAccessible(page);
  forgive(problems, `/tenants/${flows.fixed.tenant}/flow/executions`);
});

test('the sign-in flow page fits a phone', async ({ page }) => {
  test.slow();
  await page.setViewportSize(PHONE);
  await signIn(page, flows.fixed);
  await openFlow(page, flows.fixed.tenant);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expectFitsViewport(page, 'sign-in flow');
  await expectAccessible(page);
});
