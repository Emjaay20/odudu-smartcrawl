import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, expectAccessible, expectFitsViewport, PHONE } from './fixtures';

// 28rem at the 15px root size the stylesheet sets.
const CARD_WIDTH = 420;
const WIDTHS = [1440, 768, 390];

// With PAGE_SHOTS_DIR set, a page is saved in both themes at three widths.
export async function shots(page: Page, name: string): Promise<void> {
  const dir = process.env.PAGE_SHOTS_DIR;
  if (dir === undefined) return;
  mkdirSync(dir, { recursive: true });
  const viewport = page.viewportSize();
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width > 500 ? 900 : PHONE.height });
      await page.screenshot({
        path: path.join(dir, `${name}-${scheme}-${String(width)}.png`),
        fullPage: true,
      });
    }
  }
  await page.emulateMedia({ colorScheme: null });
  if (viewport !== null) await page.setViewportSize(viewport);
}

// One look at a page: accessible in both themes, inside a phone, one card.
export async function inspect(page: Page, name: string): Promise<void> {
  await expectAccessible(page);
  const desktop = page.viewportSize();
  await page.setViewportSize(PHONE);
  await expectFitsViewport(page, name);
  if (desktop !== null) await page.setViewportSize(desktop);
  const card = await page.locator('main').boundingBox();
  expect(card?.width, `${name}: the card keeps its width`).toBeCloseTo(CARD_WIDTH, 0);
  await shots(page, name);
}
