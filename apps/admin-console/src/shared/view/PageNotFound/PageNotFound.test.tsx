import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { PageNotFound } from '#/shared/view/PageNotFound';
import { axeInBothThemes } from '#/testing/axeInBothThemes';

it('says no page has the address and what to do instead', () => {
  render(<PageNotFound />);
  expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  expect(screen.getByText('Check the address, or choose an area from the menu.')).toBeVisible();
});

it('passes axe in both themes', async () => {
  expect(await axeInBothThemes(() => <PageNotFound />)).toEqual({ light: [], dark: [] });
});
