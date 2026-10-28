import { screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { axeInBothThemes } from '#/testing/axeInBothThemes';
import { brandingRoutes, draftedView, themeAnswer } from '#/testing/brandingFixtures';
import { consoleAt, renderConsoleAt } from '#/testing/renderConsole';
import { resetConsole } from '#/testing/resetConsole';

afterEach(() => {
  resetConsole();
  sessionStorage.clear();
});

const AT = '/console/acme/branding?tab=pages';

it('says which layer supplies the page’s layout, and that an empty one uses the layer below', async () => {
  renderConsoleAt(AT, brandingRoutes(themeAnswer(draftedView(), '"d1"')));
  const section = await screen.findByRole('region', { name: 'Page templates' });
  expect(
    within(section).getByText(/Draft: Instrument’s default · Published: Instrument’s default\./u),
  ).toBeVisible();
  expect(within(section).getByText(/Empty uses the layer below\./u)).toBeVisible();
});

it('shows the required parts of the sign-in page, and what it may not hold', async () => {
  renderConsoleAt(AT, brandingRoutes(themeAnswer(draftedView(), '"d1"')));
  const parts = await screen.findByRole('region', { name: 'Parts of this page' });
  for (const part of ['form.open', 'fields', 'submit', 'error', 'form.close']) {
    expect(within(parts).getByText(`{{${part}}}`)).toBeVisible();
  }
  expect(within(parts).getByText(/Scripts, styles, forms/u)).toBeVisible();
});

it('has nothing axe can find in either theme', async () => {
  const { element } = consoleAt(AT, brandingRoutes(themeAnswer(draftedView(), '"d1"')));
  const found = await axeInBothThemes(
    () => element,
    () => screen.findByRole('region', { name: 'Parts of this page' }),
    { frames: false },
  );
  expect(found).toEqual({ light: [], dark: [] });
});
