import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

it('keeps a scheme Instrument’s own until it is customised, then starts from Instrument’s colours', async () => {
  const user = userEvent.setup();
  renderConsoleAt(AT, brandingRoutes(themeAnswer(themeView())));
  const section = await screen.findByRole('region', { name: 'Colours and font' });
  expect(within(section).queryByRole('textbox', { name: 'Light page background' })).toBeNull();
  await user.click(within(section).getByRole('switch', { name: 'Use my own light colours' }));
  expect(within(section).getByRole('textbox', { name: 'Light page background' })).toHaveValue(
    '#e7eae9',
  );
  expect(within(section).getAllByRole('textbox')).toHaveLength(11);
});

it('marks a colour changed once it differs from the saved one', async () => {
  const user = userEvent.setup();
  renderConsoleAt(AT, brandingRoutes(themeAnswer(draftedView(), '"d1"')));
  const section = await screen.findByRole('region', { name: 'Colours and font' });
  expect(within(section).queryByText('Changed')).toBeNull();
  const text = within(section).getByRole('textbox', { name: 'Light text' });
  await user.clear(text);
  await user.type(text, '#000000');
  expect(within(section).getAllByText('Changed')).toHaveLength(1);
});

it('shows every pair of a customised palette with its ratio', async () => {
  renderConsoleAt(AT, brandingRoutes(themeAnswer(draftedView(), '"d1"')));
  const contrast = await screen.findByRole('region', { name: 'Contrast' });
  expect(within(contrast).getAllByRole('listitem')).toHaveLength(18);
  expect(
    within(contrast).getByText(/^Light: Text on page, \d+\.\d:1, needs 4\.5:1$/u),
  ).toBeVisible();
});

it('says Instrument’s own colours are used, and meet every requirement', async () => {
  renderConsoleAt(AT, brandingRoutes(themeAnswer(themeView())));
  const contrast = await screen.findByRole('region', { name: 'Contrast' });
  expect(
    within(contrast).getByText(
      'Instrument’s own colours are used, and they meet every requirement.',
    ),
  ).toBeVisible();
});

it('has nothing axe can find in either theme', async () => {
  const { element } = consoleAt(AT, brandingRoutes(themeAnswer(draftedView(), '"d1"')));
  const found = await axeInBothThemes(
    () => element,
    () => screen.findByRole('region', { name: 'Contrast' }),
    { frames: false },
  );
  expect(found).toEqual({ light: [], dark: [] });
});
