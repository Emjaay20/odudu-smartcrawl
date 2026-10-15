import { randomBytes } from 'node:crypto';
import { expect, signInAtTenant, test } from './fixtures';
import { psql, seed } from './stack';

const LIFETIME_SECONDS = 3;

test('signing out after the ID token has expired is immediate, with no confirmation page', async ({
  page,
}) => {
  const tenant = `lapsed-${randomBytes(4).toString('hex')}`;
  const password = randomBytes(18).toString('base64url');
  seed(['tenant', '--name', tenant]);
  seed(['user', '--tenant', tenant, '--username', 'ada', `--password=${password}`]);
  seed([
    'grant-role',
    '--tenant',
    tenant,
    '--username',
    'ada',
    '--role',
    'odudu-admin:tenant-admin',
  ]);
  psql(
    `update client_oidc_config set id_token_ttl_seconds = ${String(LIFETIME_SECONDS)} where client_id = (select id from clients where tenant_id = (select id from tenants where name = '${tenant}') and client_id = 'odudu-admin')`,
  );

  await page.goto(`/console/${tenant}`);
  await signInAtTenant(page, { tenant, username: 'ada', password });
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();

  // The ID token the console stored was issued before this instant.
  const signedInAt = Date.now();
  await expect.poll(() => Date.now() - signedInAt).toBeGreaterThan(LIFETIME_SECONDS * 1000 + 500);

  await page.getByRole('button', { name: 'Sign out' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign out?' })).toBeHidden();
});
