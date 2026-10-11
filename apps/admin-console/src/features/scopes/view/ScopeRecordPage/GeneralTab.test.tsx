import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { axeInBothThemes } from '#/testing/axeInBothThemes.ts';
import { inTurn, json, problem } from '#/testing/fakeTransport.ts';
import { consoleAt, renderConsoleAt, resetConsole } from '#/testing/renderConsole.tsx';
import { BILLING_SCOPE, SC, scopeRoutes } from '#/testing/scopesFixtures.ts';

afterEach(() => {
  resetConsole();
  sessionStorage.clear();
});

const AT = '/console/acme/scopes/s-bill';

it('shows the name and creation as fixed, and saves a description on the ETag', async () => {
  const user = userEvent.setup();
  const { sent } = renderConsoleAt(
    AT,
    scopeRoutes(undefined, {
      [`PATCH ${SC}/s-bill`]: json({ ...BILLING_SCOPE, description: 'Bills' }, 200, {
        etag: '"s-bill-2"',
      }),
    }),
  );
  expect(await screen.findByText(/A scope's name is the token a client asks for/u)).toBeVisible();
  const section = screen.getByRole('region', { name: 'Description' });
  const field = within(section).getByRole('textbox', { name: 'Description' });
  await user.clear(field);
  await user.type(field, 'Bills');
  await user.click(within(section).getByRole('button', { name: 'Save Description' }));
  await waitFor(() => {
    expect(sent.find((s) => s.method === 'PATCH')).toMatchObject({
      ifMatch: '"s-bill-1"',
      body: { description: 'Bills' },
    });
  });
});

it('sends an emptied description as null', async () => {
  const user = userEvent.setup();
  const { sent } = renderConsoleAt(
    AT,
    scopeRoutes(undefined, {
      [`PATCH ${SC}/s-bill`]: json({ ...BILLING_SCOPE, description: null }, 200, {
        etag: '"s-bill-2"',
      }),
    }),
  );
  const section = await screen.findByRole('region', { name: 'Description' });
  await user.clear(within(section).getByRole('textbox', { name: 'Description' }));
  await user.click(within(section).getByRole('button', { name: 'Save Description' }));
  await waitFor(() => {
    expect(sent.find((s) => s.method === 'PATCH')?.body).toEqual({ description: null });
  });
});

it('saves the two token flags together, changing only what was changed', async () => {
  const user = userEvent.setup();
  const { sent } = renderConsoleAt(
    AT,
    scopeRoutes(undefined, {
      [`PATCH ${SC}/s-bill`]: json({ ...BILLING_SCOPE, include_in_id_token: true }, 200, {
        etag: '"s-bill-2"',
      }),
    }),
  );
  const section = await screen.findByRole('region', { name: 'Tokens' });
  await user.click(within(section).getByRole('switch', { name: 'In the ID token' }));
  await user.click(within(section).getByRole('button', { name: 'Save Tokens' }));
  await waitFor(() => {
    expect(sent.find((s) => s.method === 'PATCH')?.body).toEqual({ include_in_id_token: true });
  });
});

it('shows a 412 as a conflict, and keeps the edit', async () => {
  const user = userEvent.setup();
  renderConsoleAt(
    AT,
    scopeRoutes(undefined, {
      [`PATCH ${SC}/s-bill`]: problem(412, 'about:blank', 'Precondition Failed'),
      [`GET ${SC}/s-bill`]: inTurn(
        json(BILLING_SCOPE, 200, { etag: '"s-bill-1"' }),
        json({ ...BILLING_SCOPE, description: 'Theirs' }, 200, { etag: '"s-bill-2"' }),
      ),
    }),
  );
  const section = await screen.findByRole('region', { name: 'Description' });
  const field = within(section).getByRole('textbox', { name: 'Description' });
  await user.clear(field);
  await user.type(field, 'Mine');
  await user.click(within(section).getByRole('button', { name: 'Save Description' }));
  expect(
    await within(section).findByRole('button', { name: 'Keep mine in Description' }),
  ).toBeVisible();
  expect(within(section).getByText('Theirs')).toBeVisible();
});

it('holds Save while the display order is not a whole number, and sends it as one', async () => {
  const user = userEvent.setup();
  const { sent } = renderConsoleAt(
    AT,
    scopeRoutes(undefined, {
      [`PATCH ${SC}/s-bill`]: json({ ...BILLING_SCOPE, display_order: 3 }, 200, {
        etag: '"s-bill-2"',
      }),
    }),
  );
  const section = await screen.findByRole('region', { name: 'Consent' });
  const order = within(section).getByRole('textbox', { name: 'Display order' });
  await user.clear(order);
  await user.type(order, 'x');
  expect(
    within(section).getAllByText('Enter a whole number, zero or more.').length,
  ).toBeGreaterThan(0);
  expect(within(section).getByRole('button', { name: 'Save Consent' })).toBeDisabled();
  await user.clear(order);
  await user.type(order, '3');
  await user.type(within(section).getByRole('textbox', { name: 'Consent text' }), 'Read bills');
  await user.click(within(section).getByRole('button', { name: 'Save Consent' }));
  await waitFor(() => {
    expect(sent.find((s) => s.method === 'PATCH')?.body).toEqual({
      consent_text: 'Read bills',
      display_order: 3,
    });
  });
});

it('chooses how a client made from now on is assigned the scope, or not at all', async () => {
  const user = userEvent.setup();
  const { sent } = renderConsoleAt(
    AT,
    scopeRoutes(undefined, {
      [`PATCH ${SC}/s-bill`]: json(
        { ...BILLING_SCOPE, default_client_assignment: 'optional' },
        200,
        { etag: '"s-bill-2"' },
      ),
    }),
  );
  const section = await screen.findByRole('region', { name: 'New clients' });
  await user.click(within(section).getByRole('button', { name: /For a client made from now on/u }));
  await user.click(await screen.findByRole('option', { name: 'Assigned as optional' }));
  await user.click(within(section).getByRole('button', { name: 'Save New clients' }));
  await waitFor(() => {
    expect(sent.find((s) => s.method === 'PATCH')?.body).toEqual({
      default_client_assignment: 'optional',
    });
  });
});

it('deletes a scope behind its typed name, and goes back to the list', async () => {
  const user = userEvent.setup();
  const { router } = renderConsoleAt(
    AT,
    scopeRoutes(undefined, {
      [`DELETE ${SC}/s-bill`]: () => new Response(null, { status: 204 }),
    }),
  );
  await user.click(await screen.findByRole('button', { name: 'Delete billing' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Delete billing?' });
  expect(dialog).toHaveTextContent('takes it off every client assigned billing');
  const confirm = within(dialog).getByRole('button', { name: 'Delete billing' });
  expect(confirm).toBeDisabled();
  await user.type(within(dialog).getByRole('textbox'), 'billing');
  await user.click(confirm);
  await waitFor(() => {
    expect(router.state.location.pathname).toBe('/acme/scopes');
  });
});

it('says in the dialog why a delete the ceiling refuses was refused, and stays', async () => {
  const user = userEvent.setup();
  renderConsoleAt(
    AT,
    scopeRoutes(undefined, {
      [`DELETE ${SC}/s-bill`]: problem(403, 'about:blank', 'Forbidden', {
        detail: 'this removes capabilities the caller does not hold: manage-keys',
      }),
    }),
  );
  await user.click(await screen.findByRole('button', { name: 'Delete billing' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Delete billing?' });
  await user.type(within(dialog).getByRole('textbox'), 'billing');
  await user.click(within(dialog).getByRole('button', { name: 'Delete billing' }));
  expect(await within(dialog).findByText(/Refused: it would take manage-keys/u)).toBeVisible();
});

it('shows the openid delete refusal as fixed text, with no delete to press', async () => {
  const { sent } = renderConsoleAt('/console/acme/scopes/s-openid', scopeRoutes());
  expect(await screen.findByText(/openid cannot be deleted/u)).toBeVisible();
  expect(screen.queryByRole('button', { name: /^Delete/u })).toBeNull();
  expect(sent.some((s) => s.method === 'DELETE')).toBe(false);
});

it('passes axe in both themes, with the delete dialog open', async () => {
  const user = userEvent.setup();
  expect(
    await axeInBothThemes(
      () => consoleAt(AT, scopeRoutes()).element,
      async () => {
        await user.click(await screen.findByRole('button', { name: 'Delete billing' }));
        await screen.findByRole('alertdialog', { name: 'Delete billing?' });
      },
    ),
  ).toEqual({ light: [], dark: [] });
});
