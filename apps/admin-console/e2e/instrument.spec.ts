import { expect, expectAccessible, test } from './fixtures';
import { seeded } from './stack';

const { admin } = seeded();
const STYLESHEET = '/instrument/instrument.css';

test('a sign-in page takes Instrument from its own origin without a policy violation', async ({
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
  // A page that already links the stylesheet is left as it is.
  if ((await page.locator(`link[rel="stylesheet"][href="${STYLESHEET}"]`).count()) === 0) {
    await page.addStyleTag({ url: STYLESHEET });
  }
  const response = await stylesheet;
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('text/css; charset=utf-8');

  const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(family.startsWith('"IBM Plex Sans"')).toBe(true);
  expect(await page.evaluate(() => document.fonts.load('400 16px "IBM Plex Sans"'))).not.toEqual(
    [],
  );
  expect(await page.evaluate(() => document.fonts.check('400 16px "IBM Plex Sans"'))).toBe(true);

  await expectAccessible(page);
  expect(refusals).toEqual([]);
});
