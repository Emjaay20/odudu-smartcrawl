import { screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { axeInBothThemes } from '#/testing/axeInBothThemes.ts';
import { json } from '#/testing/fakeTransport.ts';
import {
  consoleAt,
  GRACE,
  renderConsoleAt,
  whoami,
  resetConsole,
} from '#/testing/renderConsole.tsx';

afterEach(() => {
  resetConsole();
});

function tokensWith(capabilities: readonly string[]) {
  return {
    'GET /console/api/session': json(GRACE),
    'GET /console/api/admin/tenants/acme/whoami': whoami(capabilities),
  };
}

it('heads the page with the area, under the tenant', async () => {
  renderConsoleAt('/console/acme/registration-tokens', tokensWith(['manage-clients']));
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Registration tokens' }),
  ).toBeVisible();
  expect(
    screen.getByText('Registration tokens is not in this build of the console yet.'),
  ).toBeVisible();
});

it('says which capability the area needs when whoami says it is missing', async () => {
  renderConsoleAt('/console/acme/registration-tokens', tokensWith([]));
  expect(await screen.findByText(/manage-clients/u)).toBeVisible();
});

it('passes axe in both themes, open and refused', async () => {
  for (const capabilities of [['manage-clients'], []]) {
    const page = () => consoleAt('/console/acme/registration-tokens', tokensWith(capabilities));
    expect(
      await axeInBothThemes(
        () => page().element,
        () => screen.findByRole('heading', { level: 1, name: 'Registration tokens' }),
      ),
    ).toEqual({ light: [], dark: [] });
  }
});
