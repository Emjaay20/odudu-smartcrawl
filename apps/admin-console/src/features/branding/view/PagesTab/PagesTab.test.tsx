import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { axeInBothThemes } from '#/testing/axeInBothThemes';
import { brandingRoutes, draftedView, TH, themeAnswer } from '#/testing/brandingFixtures';
import { problem } from '#/testing/fakeTransport';
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

it('edits the template in a code field, with its parts coloured and the lines numbered', async () => {
  const user = userEvent.setup();
  renderConsoleAt(AT, brandingRoutes(themeAnswer(draftedView(), '"d1"')));
  const section = await screen.findByRole('region', { name: 'Page templates' });
  const box = within(section).getByRole('textbox', { name: 'Sign in: template' });
  await user.click(box);
  await user.paste('<p>{{intro}}</p>\n<p>{{fields}}</p>');
  expect(within(section).getByText('{{intro}}', { selector: 'pre span span' })).toBeVisible();
  const gutter = box.parentElement?.parentElement?.firstElementChild;
  expect(gutter?.textContent).toBe('1\n2');
  expect(within(section).getByText(/0 of 65,536 bytes|\d+ of 65,536 bytes/u)).toBeVisible();
  expect(box).toHaveAccessibleDescription(/Tab indents/u);
});

it('marks the line the server refused in a template, and lists why', async () => {
  const user = userEvent.setup();
  renderConsoleAt(
    AT,
    brandingRoutes(themeAnswer(draftedView(), '"d1"'), {
      [`PUT ${TH}`]: problem(400, 'about:blank', 'Bad Request', {
        errors: [
          {
            path: 'templates.sign-in',
            message: 'The slot is not a part of this page kind.',
            code: 'unknown-slot',
            detail: 'nope',
            line: 2,
            column: 4,
          },
        ],
      }),
    }),
  );
  const section = await screen.findByRole('region', { name: 'Page templates' });
  await user.click(within(section).getByRole('textbox', { name: 'Sign in: template' }));
  await user.paste('<p>{{form.open}}</p>\n<p>{{nope}}</p>');
  await user.click(within(section).getByRole('button', { name: /Save/u }));
  expect(
    await within(section).findByText('Line 2: The slot is not a part of this page kind. (nope)'),
  ).toBeVisible();
  expect(within(section).getByText('The template was not saved.')).toBeVisible();
  const scroller = section.querySelector('textarea')?.parentElement?.parentElement;
  expect(scroller?.firstElementChild?.querySelectorAll('span')).toHaveLength(1);
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
