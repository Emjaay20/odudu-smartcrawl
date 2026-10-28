import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { expect, forgive, test } from './fixtures';
import { authorize, client, LANDING, mailKey, ROOT, totp } from './page-flows';
import { BASE, COMMON_PASSWORD, forgiveRefusals, inspect } from './page-inspection';
import { randomPassword } from './password';
import { inTenant, psql, seed } from './stack';
import type { Page } from '@playwright/test';

// Every kind of page the server renders, in Arabic, reached the way a person
// reaches it from a browser that prefers Arabic: right to left, and held to the
// same axe scan in both themes, the phone's width and the card width as the
// English pages. Elements are found by name and role, never by their text,
// which is the language under test.

test.use({ locale: 'ar' });
test.describe.configure({ mode: 'serial' });

const run = Date.now().toString(36);
const PASSWORD = randomPassword('Arabic-');

const main = `ar-pages-${run}`;
const otp = `ar-pages-otp-${run}`;
const open = `ar-pages-open-${run}`;

async function expectArabic(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  expect(
    await page.evaluate(
      () => getComputedStyle(document.querySelector('main') ?? document.body).direction,
    ),
  ).toBe('rtl');
}

async function look(page: Page, name: string): Promise<void> {
  await expectArabic(page);
  await inspect(page, `ar-${name}`);
}

async function signIn(page: Page, username: string, password = PASSWORD): Promise<void> {
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('main button[type="submit"]').click();
}

function withArabic(tenant: string): void {
  psql(`update tenants set supported_locales = array['en', 'ar'] where id = ${inTenant(tenant)}`);
}

test.beforeAll(() => {
  seed(['tenant', '--name', main]);
  for (const username of ['alice', 'forced', 'passkey']) {
    seed([
      'user',
      '--tenant',
      main,
      '--username',
      username,
      `--password=${PASSWORD}`,
      ...(username === 'forced' ? ['--require-password-change'] : []),
    ]);
  }
  psql(
    `insert into user_required_actions (tenant_id, subject_id, action) select u.tenant_id, u.subject_id, 'configure-passkey' from users u where u.tenant_id = ${inTenant(main)} and u.username = 'passkey'`,
  );
  client(main, 'portal', 'Acme Reporting Portal');
  client(main, 'plain', 'Plain application');
  psql(
    `update client_oidc_config set consent_required = true where client_id in (select id from clients where tenant_id = ${inTenant(main)} and client_id = 'portal')`,
  );
  psql(
    `update client_oidc_config set frontchannel_logout_uri = '${LANDING}', post_logout_redirect_uris = '{${LANDING}}' where client_id in (select id from clients where tenant_id = ${inTenant(main)} and client_id = 'plain')`,
  );
  withArabic(main);

  seed(['tenant', '--name', otp, '--set', 'otp_required=true']);
  client(otp, 'otpapp', 'Authenticator demo');
  seed(['user', '--tenant', otp, '--username', 'bob', `--password=${PASSWORD}`]);
  withArabic(otp);

  seed([
    'tenant',
    '--name',
    open,
    '--set',
    'registration_allowed=true',
    '--set',
    'verify_email=true',
    '--set',
    'reset_password_allowed=true',
  ]);
  client(open, 'openapp', 'Open application');
  seed([
    'user',
    '--tenant',
    open,
    '--username',
    'unverified',
    `--password=${PASSWORD}`,
    '--email',
    `unverified-${run}@example.test`,
  ]);
  seed([
    'user',
    '--tenant',
    open,
    '--username',
    'resetter',
    `--password=${PASSWORD}`,
    '--email',
    `resetter-${run}@example.test`,
  ]);
  withArabic(open);
});

test('the sign-in form, its refusal and the second-factor pages', async ({ page }) => {
  await page.goto(authorize(main, 'portal'));
  await expect(page.locator('h1')).toHaveText('تسجيل الدخول');
  await expect(page.getByText('للمتابعة إلى')).toContainText('Acme Reporting Portal');
  await look(page, 'signin-empty');

  await signIn(page, 'alice', 'not the password');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('input[name="username"]')).toHaveValue('alice');
  await look(page, 'signin-error-echo');

  await page.goto(authorize(otp, 'otpapp'));
  await signIn(page, 'bob');
  await expect(page.locator('input[name="code"]')).toBeVisible();
  await page.locator('input[name="code"]').fill('000000');
  await page.locator('main button[type="submit"]').click();
  await expect(page.getByRole('alert')).toBeVisible();
  const secret = (await page.locator('main code').first().innerText()).trim();
  await look(page, 'totp-enrolment');

  await page.locator('input[name="code"]').fill(totp(secret));
  await page.locator('main button[type="submit"]').click();
  await expect(page.locator('main code').first()).toBeVisible();
  await look(page, 'recovery-codes');
  await page.locator('main button[type="submit"]').click();
  await expect(page).toHaveURL(/\/health\/ready/u);

  await page.goto(authorize(otp, 'otpapp', { prompt: 'login' }));
  await signIn(page, 'bob');
  await expect(page.locator('input[name="code"]')).toBeVisible();
  await look(page, 'second-factor-totp');
  await page.locator('input[name="code"]').fill('000000');
  await page.locator('main button[type="submit"]').click();
  await expect(page.getByRole('alert')).toBeVisible();
  await look(page, 'second-factor-totp-error');
});

test('the required-action pages: password change, passkey enrolment', async ({
  page,
  problems,
}) => {
  await page.goto(authorize(main, 'plain'));
  await signIn(page, 'forced');
  await expect(page.locator('input[name="password"]')).toBeVisible();
  await look(page, 'update-password');
  await page.locator('input[name="password"]').fill(COMMON_PASSWORD);
  await page.locator('main button[type="submit"]').click();
  await expect(page.getByRole('alert')).toBeVisible();
  await look(page, 'update-password-violations');

  await page.goto(authorize(main, 'plain', { prompt: 'login' }));
  await signIn(page, 'passkey');
  await expect(page.locator('#passkey-form')).toBeVisible();
  await look(page, 'passkey-enrolment');
  forgiveRefusals(problems);
});

test('consent, the account chooser and signing out', async ({ page, problems }) => {
  await page.goto(authorize(main, 'portal', { scope: 'openid profile offline_access' }));
  await signIn(page, 'alice');
  await expect(page.locator('button[name="decision"]').first()).toBeVisible();
  await look(page, 'consent');
  await page.locator('button[name="decision"][value="allow"]').click();
  await expect(page).toHaveURL(/\/health\/ready/u);

  await page.goto(authorize(main, 'plain', { prompt: 'select_account' }));
  await expect(page.locator('h1')).toBeVisible();
  await look(page, 'select-account');

  await page.goto(`/tenants/${main}/protocol/openid-connect/logout?client_id=plain`);
  await look(page, 'logout-confirm');
  await page.locator('main button[type="submit"]').click();
  await expect(page.locator('h1')).toBeVisible();
  await look(page, 'logout-done');

  await page.goto(`/tenants/${main}/protocol/openid-connect/logout`);
  await look(page, 'logout-no-session');

  await page.goto(authorize(main, 'plain', { prompt: 'login' }));
  await signIn(page, 'alice');
  await expect(page).toHaveURL(/\/health\/ready/u);
  await page.goto(`/tenants/${main}/protocol/openid-connect/logout?client_id=plain`);
  await page.locator('input[name="csrf"]').evaluate((input: HTMLInputElement) => {
    input.value = 'forged';
  });
  await page.locator('main button[type="submit"]').click();
  await expect(page.locator('h1')).toBeVisible();
  await look(page, 'logout-unauthenticated');
  forgiveRefusals(problems);
});

test('the error pages', async ({ page, problems }) => {
  await page.goto(authorize(main, 'portal', { redirect_uri: 'https://nowhere.example/cb' }));
  await expect(page.locator('h1')).toBeVisible();
  await look(page, 'error');

  await page.goto('/console/auth/callback?code=forged&state=forged');
  await page.goto('/console/auth/callback?code=forged&state=forged');
  await expect(page.locator('h1')).toBeVisible();
  await look(page, 'console-refusal');

  const missing = await page.goto('/nope');
  expect(missing?.status()).toBe(404);
  await look(page, 'not-found');
  forgiveRefusals(problems);
});

test('registration, the unverified account and password reset', async ({ page, problems }) => {
  await page.goto(authorize(open, 'openapp'));
  await look(page, 'signin-links');
  await page.locator('a[href*="registration"]').click();
  await expect(page.locator('input[name="password_confirm"]')).toBeVisible();
  await look(page, 'registration');

  await page.locator('main button[type="submit"]').click();
  await expect(page.getByRole('alert')).toBeVisible();
  await look(page, 'registration-required');

  await page.locator('input[name="username"]').fill('newcomer');
  await page.locator('input[name="email"]').fill(`newcomer-${run}@example.test`);
  await page.locator('input[name="password"]').fill(COMMON_PASSWORD);
  await page.locator('input[name="password_confirm"]').fill(COMMON_PASSWORD);
  await page.locator('main button[type="submit"]').click();
  await expect(page.getByRole('alert')).toBeVisible();
  await look(page, 'registration-weak');

  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('input[name="password_confirm"]').fill(PASSWORD);
  await page.locator('main button[type="submit"]').click();
  await expect(page.locator('input[name="password"]')).toHaveCount(0);
  await look(page, 'registration-succeeded');

  const key = mailKey(open, `newcomer-${run}@example.test`);
  await page.goto(`/tenants/${open}/login-actions/action-token?key=${key}`);
  await look(page, 'confirm-register');
  await page.locator('main button[type="submit"]').click();
  await expect(page.locator('h1')).toBeVisible();
  await look(page, 'registration-ready');
  await page.goto(`/tenants/${open}/login-actions/action-token?key=${key}`);
  await look(page, 'verification-failed');

  await page.goto(authorize(open, 'openapp'));
  await signIn(page, 'unverified');
  await expect(page.locator('h1')).toBeVisible();
  await look(page, 'email-unverified');

  await page.goto(`/tenants/${open}/login-actions/reset-password`);
  await look(page, 'reset-request');
  await page.locator('main button[type="submit"]').click();
  await expect(page.getByRole('alert')).toBeVisible();
  await look(page, 'reset-request-failed');
  await page.locator('input[name="email"]').fill(`resetter-${run}@example.test`);
  await page.locator('main button[type="submit"]').click();
  await expect(page.locator('input[name="email"]')).toHaveCount(0);
  await look(page, 'reset-sent');

  const reset = mailKey(open, `resetter-${run}@example.test`);
  await page.goto(`/tenants/${open}/login-actions/action-token?key=${reset}`);
  await look(page, 'reset-new-password');
  await page.locator('input[name="password"]').fill(COMMON_PASSWORD);
  await page.locator('main button[type="submit"]').click();
  await expect(page.getByRole('alert')).toBeVisible();
  await look(page, 'reset-weak');
  await page.locator('input[name="password"]').fill(`${PASSWORD}-reset`);
  await page.locator('main button[type="submit"]').click();
  await expect(page.locator('input[name="password"]')).toHaveCount(0);
  await look(page, 'reset-done');
  await page.goto(`/tenants/${open}/login-actions/action-token?key=${reset}`);
  await look(page, 'reset-link-failed');
  forgiveRefusals(problems);
});

// A failure cannot be caused on a healthy stack, so this page is the renderer's
// own output, served under the headers a real response carries.
const RENDER_SERVER_ERROR = `
const { renderServerErrorPage } = await import(process.env.RENDERER);
const { pageHeaders } = await import(process.env.HEADERS);
const page = renderServerErrorPage('01JEXAMPLEREQUESTID', { tag: 'ar', dir: 'rtl' });
process.stdout.write(JSON.stringify({ html: page.html, headers: Object.fromEntries(pageHeaders(page)) }));
`;

test('the server-error page, renderer only', async ({ page, problems }) => {
  const rendered = z.object({ html: z.string(), headers: z.record(z.string(), z.string()) }).parse(
    JSON.parse(
      execFileSync('node', ['--no-warnings', '--input-type=module', '-e', RENDER_SERVER_ERROR], {
        encoding: 'utf8',
        env: {
          ...process.env,
          RENDERER: pathToFileURL(
            path.join(ROOT, 'packages/protocol-oidc/src/view/server-error-html.ts'),
          ).href,
          HEADERS: pathToFileURL(path.join(ROOT, 'packages/kernel/src/page.ts')).href,
        },
      }),
    ),
  );
  const view = `${BASE}/server-error-view-ar`;
  await page.route(view, (route) =>
    route.fulfill({
      status: 500,
      contentType: 'text/html',
      headers: rendered.headers,
      body: rendered.html,
    }),
  );
  await page.goto(view);
  await expect(page.getByText('01JEXAMPLEREQUESTID')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await look(page, 'server-error');
  forgive(problems, '/server-error-view-ar');
});
