import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { axeInBothThemes } from '#/testing/axeInBothThemes.ts';
import { json, offline, problem } from '#/testing/fakeTransport.ts';
import { consoleAt, renderConsoleAt, resetConsole } from '#/testing/renderConsole.tsx';
import { SC, scope, scopeRoutes } from '#/testing/scopesFixtures.ts';

afterEach(() => {
  resetConsole();
});

const AT = '/console/acme/scopes/new';
const MADE = scope('s-new', 'invoices');

it('creates a scope and lands on it', async () => {
  const user = userEvent.setup();
  const { sent, router } = renderConsoleAt(
    AT,
    scopeRoutes(undefined, { [`POST ${SC}`]: json(MADE, 201) }),
  );
  expect(await screen.findByRole('heading', { level: 1, name: 'Create a scope' })).toBeVisible();
  await user.type(screen.getByRole('textbox', { name: 'Name' }), 'invoices');
  await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Reads invoices');
  await user.click(screen.getByRole('button', { name: 'Create scope' }));
  await waitFor(() => {
    expect(router.state.location.pathname).toBe('/acme/scopes/s-new');
  });
  expect(sent.find((s) => s.method === 'POST')?.body).toEqual({
    name: 'invoices',
    description: 'Reads invoices',
  });
});

it('asks for a name before sending anything', async () => {
  const user = userEvent.setup();
  const { sent } = renderConsoleAt(AT, scopeRoutes());
  await user.click(await screen.findByRole('button', { name: 'Create scope' }));
  expect(await screen.findByText('Enter a name.')).toBeVisible();
  expect(sent.some((s) => s.method === 'POST')).toBe(false);
});

it('says under the name that it is taken', async () => {
  const user = userEvent.setup();
  renderConsoleAt(
    AT,
    scopeRoutes(undefined, {
      [`POST ${SC}`]: problem(409, 'about:blank', 'Conflict', {
        detail: 'the name "billing" is already in use',
      }),
    }),
  );
  await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'billing{Enter}');
  expect(await screen.findByText('The name "billing" is already in use.')).toBeVisible();
});

it('offers a look, not another send, when the answer was lost, and lands when it finds it', async () => {
  const user = userEvent.setup();
  const { sent, router } = renderConsoleAt(
    AT,
    scopeRoutes(undefined, {
      [`POST ${SC}`]: offline(),
      [`GET ${SC}`]: json({ items: [MADE] }),
    }),
  );
  await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'invoices{Enter}');
  await user.click(await screen.findByRole('button', { name: 'Look for invoices' }));
  await waitFor(() => {
    expect(router.state.location.pathname).toBe('/acme/scopes/s-new');
  });
  expect(sent.filter((s) => s.method === 'POST')).toHaveLength(1);
});

it('passes axe in both themes', async () => {
  expect(
    await axeInBothThemes(
      () => consoleAt(AT, scopeRoutes()).element,
      () => screen.findByRole('textbox', { name: 'Name' }),
    ),
  ).toEqual({ light: [], dark: [] });
});
