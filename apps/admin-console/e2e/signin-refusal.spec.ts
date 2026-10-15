import { expect, expectAccessible, signInAtTenant, test } from './fixtures';
import { seeded } from './stack';

const account = seeded().other;
const REFUSED = 'Sign-in failed. Check your details and try again.';
const PLACEHOLDER = 'a placeholder password';

test('a wrong password at the tenant sign-in says so, keeps the name and not the password, and the next try signs in', async ({
  page,
}) => {
  await page.goto(`/console/${account.tenant}`);
  await page.getByLabel('Username').fill(account.username);
  await page.getByLabel('Password').fill(PLACEHOLDER);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page.getByRole('alert')).toHaveText(REFUSED);
  await expect(page.getByLabel('Username')).toHaveValue(account.username);
  await expect(page.getByLabel('Password')).toHaveValue('');
  await expect(page.getByLabel('Password')).toBeFocused();
  expect(await page.content()).not.toContain(PLACEHOLDER);
  await expectAccessible(page);

  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
});

test('an unknown name is refused in the same words, with that name given back', async ({
  page,
}) => {
  await page.goto(`/console/${account.tenant}`);
  await page.getByLabel('Username').fill('nobody-by-this-name');
  await page.getByLabel('Password').fill(PLACEHOLDER);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page.getByRole('alert')).toHaveText(REFUSED);
  await expect(page.getByLabel('Username')).toHaveValue('nobody-by-this-name');
  await expectAccessible(page);

  await page.getByLabel('Username').fill(account.username);
  await signInAtTenant(page, account);
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
});
