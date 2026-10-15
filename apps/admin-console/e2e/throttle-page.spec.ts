import { expect, expectAccessible, test } from './fixtures';
import { startThrottledServer, stopThrottledServer } from './stack';

const PORT = 3981;
const ORIGIN = `http://127.0.0.1:${String(PORT)}`;

test.beforeAll(async () => {
  startThrottledServer(PORT);
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(`${ORIGIN}/health/ready`)).status;
        } catch {
          return 0;
        }
      },
      { timeout: 60_000 },
    )
    .toBe(200);
});

test.afterAll(() => {
  stopThrottledServer();
});

test('the throttled sign-in page names the wait and passes axe in both themes', async ({
  page,
  request,
}) => {
  const url = `${ORIGIN}/tenants/anything/login-actions/reset-password`;
  await request.post(url, { form: { email: 'nobody@example.test' } });
  const refused = await request.post(url, { form: { email: 'nobody@example.test' } });

  expect(refused.status()).toBe(429);
  expect(refused.headers()['cache-control']).toBe('no-store');
  const wait = Number(refused.headers()['retry-after']);
  await page.setContent(await refused.text());
  await expect(page.getByRole('heading', { level: 1, name: 'Too many attempts' })).toBeVisible();
  await expect(page.getByText(`Try again in ${String(wait)} seconds.`)).toBeVisible();
  await expectAccessible(page);
});
