import type { Browser, FrameLocator, Locator, Page } from '@playwright/test';
import {
  expect,
  expectAccessible,
  expectFitsViewport,
  forgive,
  signIn,
  tabsWithin,
  test,
  LAPTOP,
  PHONE,
} from './fixtures';
import { authorize } from './page-flows';
import { seeded } from './stack';

const { branding } = seeded().config;
const TABLET = { width: 768, height: 1024 };

// A 1 x 1 PNG, which is all a logo needs to be to be stored.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const tabTo = tabsWithin(120);
const FRAME = 'iframe[title="Preview of the page"]';

async function openBranding(page: Page, tenant: string): Promise<void> {
  await page.goto(`/console/${tenant}/branding`);
  await expect(page.getByRole('heading', { level: 1, name: 'Branding' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Colours and font' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
}

function preview(page: Page): FrameLocator {
  return page.frameLocator(FRAME);
}

async function customiseLight(page: Page, background: string): Promise<Locator> {
  const section = page.getByRole('region', { name: 'Colours and font' });
  await section.getByText('Use my own light colours', { exact: true }).click();
  await section
    .getByRole('textbox', { name: 'Light page background', exact: true })
    .fill(background);
  return section;
}

async function save(section: Locator): Promise<void> {
  await section.getByRole('button', { name: /^Save/u }).click();
  await expect(section.getByRole('button', { name: /^Save/u })).toBeHidden();
}

// What the real sign-in page of the tenant's application looks like to a
// visitor who has never been to the console.
async function visit(
  browser: Browser,
  tenant: string,
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ colorScheme: 'light' });
  const page = await context.newPage();
  await page.goto(authorize(tenant, 'brand-app'));
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  return { page, close: () => context.close() };
}

const surface = (page: Page): Promise<string> =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test('a sandboxed preview is drawn styled, and a published theme changes the real sign-in page', async ({
  page,
  browser,
}) => {
  test.slow();
  const { publish } = branding;
  await signIn(page, publish);
  await openBranding(page, publish.tenant);

  const frame = page.locator(FRAME);
  await expect(frame).toHaveAttribute('sandbox', '');
  await expect(preview(page).getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();

  const section = await customiseLight(page, '#ffe8d6');
  await save(section);
  await expect(page.getByRole('region', { name: 'Status' })).toContainText(
    'A saved draft is waiting',
  );
  const body = preview(page).locator('body');
  await expect
    .poll(() => body.evaluate((node) => getComputedStyle(node).backgroundColor))
    .toBe('rgb(255, 232, 214)');

  // The frame has no origin of its own, and Instrument's stylesheet and its
  // fonts still arrive in it.
  const fonts = await body.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((face) => face.status === 'loaded')
      .map((face) => face.family);
  });
  expect(fonts.length).toBeGreaterThan(0);
  expect(await body.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain(
    'IBM Plex',
  );

  const before = await visit(browser, publish.tenant);
  expect(await surface(before.page)).not.toBe('rgb(255, 232, 214)');
  await before.close();

  await page.getByRole('button', { name: 'Publish the draft' }).click();
  await expect(page.getByRole('region', { name: 'Status' })).toContainText(
    'Version 1 is published.',
  );
  const after = await visit(browser, publish.tenant);
  expect(await surface(after.page)).toBe('rgb(255, 232, 214)');
  await after.close();
});

test('uploads a logo, requires its alt text, and says why a file was refused', async ({
  page,
  problems,
}) => {
  test.slow();
  const { upload } = branding;
  await signIn(page, upload);
  await openBranding(page, upload.tenant);
  const images = page.getByRole('region', { name: 'Images' });

  await images
    .getByRole('group', { name: 'Logo', exact: true })
    .locator('input[type="file"]')
    .setInputFiles({
      name: 'forged.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not an image'),
    });
  await expect(images.getByText('That is not a PNG, a JPEG or a WebP.')).toBeVisible();
  forgive(problems, '/theme/assets?kind=logo');

  await images
    .getByRole('group', { name: 'Logo', exact: true })
    .locator('input[type="file"]')
    .setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
  await expect(images.getByText(/^An image is set \(/u)).toBeVisible();
  await expect(images.getByRole('button', { name: /^Save/u })).toBeDisabled();
  await images.getByRole('textbox', { name: 'Logo: alt text', exact: true }).fill('Acme');
  await save(images);

  await expect(preview(page).getByRole('img', { name: 'Acme' })).toBeVisible();
  await expectAccessible(page, { exclude: [FRAME] });
});

test('a failing contrast pair blocks publishing, and the server is not asked', async ({ page }) => {
  test.slow();
  const { contrast } = branding;
  await signIn(page, contrast);
  await openBranding(page, contrast.tenant);
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/theme/publish')) requests.push(request.url());
  });

  const section = page.getByRole('region', { name: 'Colours and font' });
  await section.getByText('Use my own light colours', { exact: true }).click();
  await section.getByRole('textbox', { name: 'Light text', exact: true }).fill('#e0e0e0');
  const panel = page.getByRole('region', { name: 'Contrast' });
  await expect(panel.getByRole('status')).toContainText(/fail/u);
  await save(section);

  const publish = page.getByRole('region', { name: 'Publish' });
  await expect(publish.getByRole('button', { name: 'Publish the draft' })).toBeDisabled();
  await expect(publish.getByRole('note')).toContainText(
    'Fix the contrast before publishing: Light: Text on page',
  );
  expect(requests).toEqual([]);
});

test('reset asks first, then returns the tenant to Instrument’s own pages', async ({
  page,
  browser,
}) => {
  test.slow();
  const { reset } = branding;
  await signIn(page, reset);
  await openBranding(page, reset.tenant);
  const section = await customiseLight(page, '#d6f0ff');
  await save(section);
  await page.getByRole('button', { name: 'Publish the draft' }).click();
  await expect(page.getByRole('region', { name: 'Status' })).toContainText(
    'Version 1 is published.',
  );
  const themed = await visit(browser, reset.tenant);
  expect(await surface(themed.page)).toBe('rgb(214, 240, 255)');
  await themed.close();

  await page.getByRole('button', { name: 'Reset to default…' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Deletes the draft and unpublishes the theme');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('region', { name: 'Status' })).toContainText(
    'Version 1 is published.',
  );

  await page.getByRole('button', { name: 'Reset to default…' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reset to default' }).click();
  await expect(page.getByRole('region', { name: 'Status' })).toContainText('Nothing published yet');
  const plain = await visit(browser, reset.tenant);
  expect(await surface(plain.page)).not.toBe('rgb(214, 240, 255)');
  await plain.close();
});

test('works from the keyboard alone', async ({ page }) => {
  test.slow();
  const { keyed } = branding;
  await signIn(page, keyed);
  await openBranding(page, keyed.tenant);
  const section = page.getByRole('region', { name: 'Colours and font' });
  const light = section.getByRole('switch', { name: 'Use my own light colours' });
  await tabTo(page, light);
  await page.keyboard.press('Space');
  await expect(light).toBeChecked();
  const background = section.getByRole('textbox', { name: 'Light page background', exact: true });
  await tabTo(page, background);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('#fff0e0');
  await tabTo(page, section.getByRole('button', { name: /^Save/u }));
  await page.keyboard.press('Enter');
  await expect(section.getByRole('button', { name: /^Save/u })).toBeHidden();
  await expect(page.getByRole('region', { name: 'Status' })).toContainText('A saved draft');

  // The Pages tab, by arrow, then a page picked and a template written. Tab
  // would go through the stylesheet editor, which indents until Escape.
  await page.getByRole('tab', { name: 'Theme' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('region', { name: 'Page templates' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Pages' })).toHaveAttribute('aria-selected', 'true');
});

for (const [name, viewport] of [
  ['a phone', PHONE],
  ['a tablet', TABLET],
  ['a laptop', LAPTOP],
] as const) {
  test.describe(`on ${name}`, () => {
    test.use({ viewport });

    test('both tabs fit, with a long list of refusals', async ({ page, problems }) => {
      test.slow();
      const { layout } = branding;
      await signIn(page, layout);
      await openBranding(page, layout.tenant);
      await expectFitsViewport(page);
      const section = await customiseLight(page, '#ffffff');
      await expectFitsViewport(page);
      await section.getByRole('button', { name: /^Discard/u }).click();

      await page.getByRole('tab', { name: 'Pages' }).click();
      const templates = page.getByRole('region', { name: 'Page templates' });
      await expect(templates).toBeVisible();
      const slots = Array.from({ length: 30 }, (_, index) => `{{unknown${String(index)}}}`).join(
        ' ',
      );
      await templates.getByRole('textbox', { name: 'Sign in: template', exact: true }).fill(slots);
      await templates.getByRole('button', { name: /^Save/u }).click();
      await expect(templates.getByText(/and \d+ more problems?/iu)).toBeVisible();
      forgive(problems, '/theme');
      await expectFitsViewport(page);
      await expectAccessible(page, { exclude: [FRAME] });
    });
  });
}

const STYLED = 'h1 {\n  color: #aa0000;\n}';

test('edits the stylesheet, meets a refusal on its line, and publishes it to the real sign-in page', async ({
  page,
  browser,
  problems,
}) => {
  test.slow();
  const { styled } = branding;
  await signIn(page, styled);
  await openBranding(page, styled.tenant);
  const section = page.getByRole('region', { name: 'Stylesheet', exact: true });
  const editor = section.getByRole('textbox', { name: 'Stylesheet CSS' });

  // Tab indents, and Escape then Tab lets go.
  await editor.click();
  await page.keyboard.press('Tab');
  await expect(editor).toHaveValue('  ');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await expect(editor).not.toBeFocused();
  await editor.fill('h1 {\n  behavior: none;\n}');

  await section.getByRole('button', { name: /^Save/u }).click();
  await expect(section.getByText('Line 2: This property is not allowed. (behavior)')).toBeVisible();
  await expect(section.getByText('The stylesheet was not saved.')).toBeVisible();
  forgive(problems, '/theme');
  await expectAccessible(page, { exclude: [FRAME] });

  await editor.fill(STYLED);
  await expect(section.getByText(/^Line 2:/u)).toBeHidden();
  await save(section);
  const heading = preview(page).getByRole('heading', { level: 1, name: 'Sign in' });
  await expect(heading).toHaveCSS('color', 'rgb(170, 0, 0)');

  const before = await visit(browser, styled.tenant);
  const colour = (visitor: Page): Promise<string> =>
    visitor
      .getByRole('heading', { level: 1, name: 'Sign in' })
      .evaluate((node) => getComputedStyle(node).color);
  expect(await colour(before.page)).not.toBe('rgb(170, 0, 0)');
  await before.close();

  await page.getByRole('button', { name: 'Publish the draft' }).click();
  await expect(page.getByRole('region', { name: 'Status' })).toContainText(
    'Version 1 is published.',
  );
  const after = await visit(browser, styled.tenant);
  expect(await colour(after.page)).toBe('rgb(170, 0, 0)');
  await after.close();
  await expectAccessible(page, { exclude: [FRAME] });
});

const MAIL_FRAME = 'iframe[title="Preview of the verification mail"]';

test('frames the verification mail without a script, in either scheme', async ({ page }) => {
  test.slow();
  const { mail } = branding;
  await signIn(page, mail);
  await page.goto(`/console/${mail.tenant}/branding?tab=mail`);
  const frame = page.locator(MAIL_FRAME);
  await expect(frame).toHaveAttribute('sandbox', '');
  const body = page.frameLocator(MAIL_FRAME);
  await expect(body.getByRole('heading', { name: 'Verify your email address' })).toBeVisible();
  const background = (): Promise<string> =>
    body.locator('body').evaluate((node) => getComputedStyle(node).backgroundColor);
  const light = await background();

  await page.getByRole('button', { name: /Colour scheme/u }).click();
  await page.getByRole('option', { name: 'Dark' }).click();
  await expect(body.getByRole('heading', { name: 'Verify your email address' })).toBeVisible();
  await expect.poll(background).not.toBe(light);

  await expect(page.getByRole('region', { name: 'Light colours' })).toContainText(
    'Odudu’s default.',
  );
  await expectAccessible(page, { exclude: [MAIL_FRAME] });
});

test('sets a message override, refuses a key that is not a message, and removes it', async ({
  page,
  problems,
}) => {
  test.slow();
  const { languages } = branding;
  await signIn(page, languages);
  await page.goto(`/console/${languages.tenant}/branding?tab=languages`);
  const key = page.getByRole('textbox', { name: /Message key/u });
  const text = page.getByRole('textbox', { name: /Text shown instead/u });

  await key.fill('no.such.key');
  await text.fill('Hello');
  await page.getByRole('button', { name: 'Save override' }).click();
  await expect(page.getByText(/not the key of any page message/u)).toBeVisible();
  forgive(problems, '/message-overrides/en/no.such.key');

  await key.fill('login.title');
  await text.fill('Welcome back');
  await page.getByRole('button', { name: 'Save override' }).click();
  const table = page.getByRole('grid', { name: 'Message overrides' });
  await expect(table.getByRole('row', { name: /login\.title/u })).toContainText('Welcome back');

  await page.getByRole('button', { name: 'Remove login.title' }).click();
  await page.getByRole('button', { name: 'Remove override' }).click();
  await expect(page.getByText('No overrides yet')).toBeVisible();
});
