import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { axeInBothThemes } from '#/testing/axeInBothThemes.ts';
import { json, problem } from '#/testing/fakeTransport.ts';
import { consoleAt, renderConsoleAt, resetConsole } from '#/testing/renderConsole.tsx';
import { A, BILLING_CARRIES, carrier, SC, scopeRoutes } from '#/testing/scopesFixtures.ts';

afterEach(() => {
  resetConsole();
  sessionStorage.clear();
});

const AT = '/console/acme/scopes/s-bill?tab=clients';

async function open() {
  return screen.findByRole('region', { name: 'Clients carrying billing' });
}

it('lists the clients that carry the scope by name and client id, each with its assignment', async () => {
  const { sent } = renderConsoleAt(AT, scopeRoutes());
  await open();
  const list = await screen.findByRole('list', { name: 'Clients carrying billing' });
  const row = within(list).getByRole('listitem');
  expect(row).toHaveTextContent('Billing');
  expect(row).toHaveTextContent('billing');
  expect(within(row).getByRole('button', { name: /Assignment for Billing/u })).toHaveTextContent(
    'Default',
  );
  expect(screen.getByText(/ 1 client\.$/u)).toBeVisible();
  expect(sent.some((s) => s.path === `${SC}/s-bill/clients`)).toBe(true);
});

it('loads the next page of clients by the cursor the server gave', async () => {
  const user = userEvent.setup();
  const { sent } = renderConsoleAt(
    AT,
    scopeRoutes(undefined, {
      [`GET ${SC}/s-bill/clients`]: (request) =>
        request.search.get('cursor') === null
          ? json({ items: [BILLING_CARRIES], next: 'cur2' })(request)
          : json({ items: [carrier('c-portal', 'portal', 'Portal', 'optional')] })(request),
    }),
  );
  await open();
  await user.click(await screen.findByRole('button', { name: 'Load more clients' }));
  expect(await screen.findByText('Portal')).toBeVisible();
  expect(sent.some((s) => s.search.get('cursor') === 'cur2')).toBe(true);
});

it('says no client carries a scope none carries', async () => {
  renderConsoleAt('/console/acme/scopes/s-rep?tab=clients', scopeRoutes());
  expect(await screen.findByText('No client carries reports:read.')).toBeVisible();
});

it('searches clients on the server, never in the browser, and assigns the one chosen', async () => {
  const user = userEvent.setup();
  const { sent } = renderConsoleAt(
    AT,
    scopeRoutes(undefined, {
      [`PUT ${SC}/s-bill/clients/c-portal`]: json({ client_id: 'c-portal', scopes: [] }, 200, {
        etag: '"c-portal-2"',
      }),
    }),
  );
  const assign = await screen.findByRole('region', { name: 'Assign to a client' });
  await user.type(within(assign).getByRole('searchbox', { name: 'Search clients by name' }), 'por');
  await user.click(within(assign).getByRole('button', { name: 'Search' }));
  await waitFor(() => {
    expect(sent.some((s) => s.path === `${A}/clients` && s.search.get('name') === 'por')).toBe(
      true,
    );
  });
  await user.click(await within(assign).findByRole('option', { name: /portal/u }));
  await user.click(within(assign).getByRole('button', { name: 'Assign to portal' }));
  await waitFor(() => {
    expect(sent.find((s) => s.method === 'PUT')).toMatchObject({
      path: `${SC}/s-bill/clients/c-portal`,
      body: { assignment: 'default' },
    });
  });
});

it("reads the client's record again after an assignment, so its next save is not a 412", async () => {
  const user = userEvent.setup();
  const { sent } = renderConsoleAt(
    AT,
    scopeRoutes(undefined, {
      [`PUT ${SC}/s-bill/clients/c-portal`]: json({ client_id: 'c-portal', scopes: [] }),
    }),
  );
  const assign = await screen.findByRole('region', { name: 'Assign to a client' });
  await user.click(await within(assign).findByRole('option', { name: /portal/u }));
  await user.click(within(assign).getByRole('button', { name: 'Assign to portal' }));
  await waitFor(() => {
    expect(sent.some((s) => s.method === 'PUT')).toBe(true);
  });
  await waitFor(() => {
    expect(
      sent.filter((s) => s.path === `${SC}/s-bill/clients` && s.method === 'GET').length,
    ).toBeGreaterThan(1);
  });
});

it('changes an assignment and unassigns, each at once', async () => {
  const user = userEvent.setup();
  const { sent } = renderConsoleAt(
    AT,
    scopeRoutes(undefined, {
      [`PUT ${SC}/s-bill/clients/c-bill`]: json({ client_id: 'c-bill', scopes: [] }),
      [`DELETE ${SC}/s-bill/clients/c-bill`]: () => new Response(null, { status: 204 }),
    }),
  );
  const row = await within(
    await screen.findByRole('list', { name: 'Clients carrying billing' }),
  ).findByRole('listitem');
  await user.click(within(row).getByRole('button', { name: /Assignment for Billing/u }));
  await user.click(await screen.findByRole('option', { name: 'Optional' }));
  await waitFor(() => {
    expect(sent.find((s) => s.method === 'PUT')?.body).toEqual({ assignment: 'optional' });
  });
  await user.click(within(row).getByRole('button', { name: 'Unassign Billing' }));
  await waitFor(() => {
    expect(sent.some((s) => s.method === 'DELETE')).toBe(true);
  });
});

it("words a 403 over the client's service account, naming the capability", async () => {
  const user = userEvent.setup();
  renderConsoleAt(
    AT,
    scopeRoutes(undefined, {
      [`PUT ${SC}/s-bill/clients/c-portal`]: problem(403, 'about:blank', 'Forbidden', {
        detail: 'the caller does not hold: manage-keys',
      }),
    }),
  );
  const assign = await screen.findByRole('region', { name: 'Assign to a client' });
  await user.click(await within(assign).findByRole('option', { name: /portal/u }));
  await user.click(within(assign).getByRole('button', { name: 'Assign to portal' }));
  expect(await screen.findByText(/Refused: it would hand out manage-keys/u)).toBeVisible();
});

it('lists the carriers but offers no client search to a caller without manage-clients', async () => {
  const { sent } = renderConsoleAt(AT, scopeRoutes(['manage-tenant']));
  await open();
  expect(await screen.findByRole('note')).toHaveTextContent('needs the manage-clients capability');
  expect(screen.queryByRole('region', { name: 'Assign to a client' })).toBeNull();
  expect(sent.some((s) => s.path === `${A}/clients`)).toBe(false);
});

it('passes axe in both themes', async () => {
  expect(
    await axeInBothThemes(
      () => consoleAt(AT, scopeRoutes()).element,
      () => screen.findByRole('region', { name: 'Assign to a client' }),
    ),
  ).toEqual({ light: [], dark: [] });
});
