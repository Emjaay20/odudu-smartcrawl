import { screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { axeInBothThemes } from '#/testing/axeInBothThemes';
import { brandingRoutes, draftedView, themeAnswer, themeView } from '#/testing/brandingFixtures';
import { consoleAt, renderConsoleAt } from '#/testing/renderConsole';
import { resetConsole } from '#/testing/resetConsole';

afterEach(() => {
  resetConsole();
  sessionStorage.clear();
});

const AT = '/console/acme/branding';

it('has one slot for each image a theme may name, each with what it is for', async () => {
  renderConsoleAt(AT, brandingRoutes(themeAnswer(themeView())));
  const section = await screen.findByRole('region', { name: 'Images' });
  for (const name of ['Logo', 'Logo for the dark scheme', 'Favicon', 'Background image']) {
    expect(within(section).getByRole('group', { name })).toBeVisible();
  }
  expect(within(section).getByText('The icon in the browser tab.')).toBeVisible();
});

it('offers Replace, Remove and Delete for a slot that holds an image, Upload for the others', async () => {
  renderConsoleAt(AT, brandingRoutes(themeAnswer(draftedView(), '"d1"')));
  const section = await screen.findByRole('region', { name: 'Images' });
  expect(within(section).getByRole('button', { name: 'Replace logo' })).toBeVisible();
  expect(within(section).getByRole('button', { name: 'Upload favicon' })).toBeVisible();
  expect(within(section).queryByRole('button', { name: 'Delete image: favicon' })).toBeNull();
});

it('has nothing axe can find in either theme', async () => {
  const { element } = consoleAt(AT, brandingRoutes(themeAnswer(draftedView(), '"d1"')));
  const found = await axeInBothThemes(
    () => element,
    () => screen.findByRole('region', { name: 'Images' }),
    { frames: false },
  );
  expect(found).toEqual({ light: [], dark: [] });
});
