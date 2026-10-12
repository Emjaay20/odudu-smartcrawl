import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { axeInBothThemes } from '#/testing/axeInBothThemes';
import { inTurn, json, problem } from '#/testing/fakeTransport';
import { consoleAt, renderConsoleAt, resetConsole } from '#/testing/renderConsole';
import { BILLING_CARRIES, BILLING_SCOPE, SC, scopeRoutes } from '#/testing/scopesFixtures';

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

it('saves a second time on the ETag the first save answered', async () => {
  const user = userEvent.setup();
  const { sent } = renderConsoleAt(
    AT,
    scopeRoutes(undefined, {
      [`GET ${SC}/s-bill`]: inTurn(
        json(BILLING_SCOPE, 200, { etag: '"s-bill-1"' }),
        json({ ...BILLING_SCOPE, description: 'One' }, 200, { etag: '"s-bill-2"' }),
      ),
      [`PATCH ${SC}/s-bill`]: inTurn(
        json({ ...BILLING_SCOPE, description: 'One' }, 200, { etag: '"s-bill-2"' }),
        json({ ...BILLING_SCOPE, description: 'Two' }, 200, { etag: '"s-bill-3"' }),
      ),
    }),
  );
  const section = await screen.findByRole('region', { name: 'Description' });
  const field = within(section).getByRole('textbox', { name: 'Description' });
  await user.clear(field);
  await user.type(field, 'One');
  await user.click(within(section).getByRole('button', { name: 'Save Description' }));
  await waitFor(() => {
    expect(within(section).queryByRole('button', { name: 'Save Description' })).toBeNull();
  });
  await user.clear(field);
  await user.type(field, 'Two');
  await user.click(within(section).getByRole('button', { name: 'Save Description' }));
  await waitFor(() => {
    expect(sent.filter((s) => s.method === 'PATCH').map((s) => s.ifMatch)).toEqual([
      '"s-bill-1"',
      '"s-bill-2"',
    ]);
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

async function openDeletion() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Delete billing' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Delete billing?' });
  return { user, dialog };
}

it('warns, before the name is typed, how many clients carry the scope', async () => {
  renderConsoleAt(AT, scopeRoutes());
  const { dialog } = await openDeletion();
  expect(
    await within(dialog).findByText(/1 client carries billing and will stop receiving its claims/u),
  ).toBeVisible();
  expect(within(dialog).getByRole('button', { name: 'Delete billing' })).toBeDisabled();
});

it('says no client carries a scope none is assigned', async () => {
  renderConsoleAt(
    AT,
    scopeRoutes(undefined, { [`GET ${SC}/s-bill/clients`]: json({ items: [] }) }),
  );
  const { dialog } = await openDeletion();
  expect(await within(dialog).findByText(/No client carries billing/u)).toBeVisible();
});

it('reads one page only, and says "or more" when another is there', async () => {
  const { sent } = renderConsoleAt(
    AT,
    scopeRoutes(undefined, {
      [`GET ${SC}/s-bill/clients`]: json({ items: [BILLING_CARRIES], next: 'cursor-2' }),
    }),
  );
  const { dialog } = await openDeletion();
  expect(await within(dialog).findByText(/1 or more clients carry billing/u)).toBeVisible();
  expect(sent.filter((s) => s.method === 'GET' && s.path.endsWith('/s-bill/clients'))).toHaveLength(
    1,
  );
});

it('never says none when the clients cannot be read', async () => {
  renderConsoleAt(
    AT,
    scopeRoutes(undefined, {
      [`GET ${SC}/s-bill/clients`]: problem(403, 'about:blank', 'Forbidden', {
        detail: 'requires manage-clients',
      }),
    }),
  );
  const { dialog } = await openDeletion();
  expect(
    await within(dialog).findByText(/How many clients carry billing could not be read/u),
  ).toBeVisible();
  expect(dialog).not.toHaveTextContent('No client carries');
  expect(within(dialog).getByRole('button', { name: 'Delete billing' })).toBeDisabled();
});

it('names the mappers behind its claims', async () => {
  renderConsoleAt(
    AT,
    scopeRoutes(undefined, {
      [`GET ${SC}/s-bill/mappers`]: json(
        { available: ['email', 'groups'], bound: ['groups'], declared: ['email'] },
        200,
        { etag: '"s-bill-m1"' },
      ),
    }),
  );
  const { dialog } = await openDeletion();
  expect(await within(dialog).findByText(/Its claims come from the groups mapper/u)).toBeVisible();
});

it('still deletes only once the name is typed, after the warning', async () => {
  const { router } = renderConsoleAt(
    AT,
    scopeRoutes(undefined, { [`DELETE ${SC}/s-bill`]: () => new Response(null, { status: 204 }) }),
  );
  const { user, dialog } = await openDeletion();
  await within(dialog).findByText(/1 client carries billing/u);
  await user.type(within(dialog).getByRole('textbox'), 'billing');
  await user.click(within(dialog).getByRole('button', { name: 'Delete billing' }));
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
