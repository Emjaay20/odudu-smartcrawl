import { expect, expectAccessible, signIn, test } from './fixtures';
import { shots } from './page-inspection';
import { seeded } from './stack';

const { admin } = seeded();

test('a screen the console does not have shows the lost route, inside the signed-in shell', async ({
  page,
}) => {
  await signIn(page, admin);
  await page.goto(`/console/${admin.tenant}/no-such-screen`);
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: `Areas of ${admin.tenant}` })).toBeVisible();

  const art = page.locator('main svg[aria-hidden="true"]');
  await expect(art).toHaveCount(1);
  const moving = art.locator('path').nth(1);
  const animation = (): Promise<string> =>
    moving.evaluate((element) => getComputedStyle(element).animationName);
  // The run's default is reduced motion: the final frame, nothing playing.
  expect(await animation()).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await animation()).not.toBe('none');
  await art.hover();
  expect(await animation()).toContain('again');
  await page.mouse.move(0, 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await art.hover();
  expect(await animation()).toBe('none');
  await page.mouse.move(0, 0);

  await expectAccessible(page);
  await shots(page, 'console-lost');
});
