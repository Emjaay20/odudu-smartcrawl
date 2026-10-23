import { expect, expectAccessible, test } from './fixtures';
import { seeded } from './stack';

const { admin } = seeded();
const STYLESHEET = '/instrument/instrument.css';

test('the sign-in page links the Instrument stylesheet, favicon and mark, and its policy admits them', async ({
  page,
}) => {
  const refusals: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Content Security Policy|securitypolicyviolation/iu.test(text)) refusals.push(text);
  });
  const stylesheet = page.waitForResponse((response) => response.url().endsWith(STYLESHEET));

  await page.goto(`/console/${admin.tenant}`);
  await expect(page.getByLabel('Username')).toBeVisible();
  await expect(page.locator(`link[rel="stylesheet"][href="${STYLESHEET}"]`)).toHaveCount(1);
  await expect(page.locator('link[rel="icon"][href="/instrument/favicon.svg"]')).toHaveCount(1);
  await expect(page.locator('link[rel="icon"][href="/instrument/favicon.ico"]')).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('main.page svg.mark')).toHaveCount(1);
  const response = await stylesheet;
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('text/css; charset=utf-8');

  const mark = await page.request.get('/instrument/mark.svg');
  expect(mark.status()).toBe(200);
  expect(mark.headers()['content-type']).toBe('image/svg+xml');

  const favicon = await page.request.get('/instrument/favicon.svg');
  expect(favicon.status()).toBe(200);
  expect(favicon.headers()['content-type']).toBe('image/svg+xml');
  const ico = await page.request.get('/instrument/favicon.ico');
  expect(ico.status()).toBe(200);
  expect(ico.headers()['content-type']).toBe('image/x-icon');
  expect((await page.request.get('/favicon.ico')).headers()['content-type']).toBe('image/x-icon');

  const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(family.startsWith('"IBM Plex Sans"')).toBe(true);
  expect(await page.evaluate(() => document.fonts.load('400 16px "IBM Plex Sans"'))).not.toEqual(
    [],
  );
  expect(await page.evaluate(() => document.fonts.check('400 16px "IBM Plex Sans"'))).toBe(true);

  await expectAccessible(page);
  expect(refusals).toEqual([]);
});
