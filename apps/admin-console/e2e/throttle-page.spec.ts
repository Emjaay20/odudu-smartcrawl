import { expect, forgive, test } from './fixtures';
import { inspect } from './page-inspection';
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
  problems,
}) => {
  const url = `${ORIGIN}/tenants/anything/login-actions/reset-password`;
  await request.post(url, { form: { email: 'nobody@example.test' } });
  const refused = await request.post(url, { form: { email: 'nobody@example.test' } });

  expect(refused.status()).toBe(429);
  expect(refused.headers()['cache-control']).toBe('no-store');
  const wait = Number(refused.headers()['retry-after']);
  // Served the way the server sent it, so the stylesheet its policy allows loads.
  const view = `${ORIGIN}/throttled-view`;
  await page.route(view, (route) => route.fulfill({ response: refused }));
  await page.goto(view);
  await expect(page.getByRole('heading', { level: 1, name: 'Too many attempts' })).toBeVisible();
  await expect(page.getByText(`Try again in ${String(wait)} seconds.`)).toBeVisible();
  await inspect(page, 'throttle');
  forgive(problems, '/throttled-view');
});
