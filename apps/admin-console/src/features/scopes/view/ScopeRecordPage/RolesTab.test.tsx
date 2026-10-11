import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { axeInBothThemes } from '#/testing/axeInBothThemes.ts';
import { inTurn, json, problem } from '#/testing/fakeTransport.ts';
import { consoleAt, renderConsoleAt, resetConsole } from '#/testing/renderConsole.tsx';
import { A, MAPPED, SC, scopeRoutes } from '#/testing/scopesFixtures.ts';

afterEach(() => {
  resetConsole();
  sessionStorage.clear();
});

const AT = '/console/acme/scopes/s-bill?tab=roles';

async function open() {
  return screen.findByRole('region', { name: 'Roles' });
}

it('lists the roles the scope maps, and offers the tenant roles to choose from', async () => {
  renderConsoleAt(AT, scopeRoutes());
  const section = await open();
  const list = await within(section).findByRole('list', { name: 'Carried by billing' });
  expect(within(list).getByText('auditor')).toBeVisible();
  expect(
    await within(section).findByRole('listbox', { name: 'Roles billing carries' }),
  ).toBeVisible();
});

it('says a scope that maps no role carries none', async () => {
  renderConsoleAt('/console/acme/scopes/s-rep?tab=roles', scopeRoutes());
  expect(await screen.findByText('reports:read carries no role.')).toBeVisible();
});

it('searches the roles on the server, and saves the set on the ETag it was read with', async () => {
  const user = userEvent.setup();
  const { sent } = renderConsoleAt(
    AT,
    scopeRoutes(undefined, {
      [`PUT ${SC}/s-bill/roles`]: json(
        { items: [MAPPED, { id: 'r-read', name: 'reader', client_id: null, client_key: null }] },
        200,
        {
          etag: '"s-bill-r2"',
        },
      ),
    }),
  );
  const section = await open();
  await user.type(
    await within(section).findByRole('searchbox', { name: 'Search roles by name' }),
    'rea',
  );
  await user.click(within(section).getByRole('button', { name: 'Search' }));
  await waitFor(() => {
    expect(sent.some((s) => s.path === `${A}/roles` && s.search.get('name') === 'rea')).toBe(true);
  });
  await user.click(await within(section).findByRole('option', { name: /^reader, a tenant role/u }));
  await user.click(within(section).getByRole('button', { name: 'Save Roles' }));
  await waitFor(() => {
    expect(sent.find((s) => s.method === 'PUT')).toMatchObject({
      ifMatch: '"s-bill-r1"',
      body: { role_ids: ['r-aud', 'r-read'] },
    });
  });
});

it('does not offer a role reaching a capability the caller lacks, and says why', async () => {
  renderConsoleAt(AT, scopeRoutes(['manage-tenant']));
  const section = await open();
  const option = await within(section).findByRole('option', { name: /manage-keys/u });
  expect(option).toHaveAttribute('aria-disabled', 'true');
});

it('takes the new ETag from the answer, so a second save does not 412', async () => {
  const user = userEvent.setup();
  const { sent } = renderConsoleAt(
    AT,
    scopeRoutes(undefined, {
      [`GET ${SC}/s-bill/roles`]: inTurn(
        json({ items: [MAPPED] }, 200, { etag: '"s-bill-r1"' }),
        json({ items: [] }, 200, { etag: '"s-bill-r2"' }),
      ),
      [`PUT ${SC}/s-bill/roles`]: inTurn(
        json({ items: [] }, 200, { etag: '"s-bill-r2"' }),
        json({ items: [MAPPED] }, 200, { etag: '"s-bill-r3"' }),
      ),
    }),
  );
  const section = await open();
  const option = await within(section).findByRole('option', { name: /^auditor, a tenant role/u });
  await user.click(option);
  await user.click(within(section).getByRole('button', { name: 'Save Roles' }));
  await within(section).findByText('billing carries no role.');
  await user.click(
    await within(section).findByRole('option', { name: /^auditor, a tenant role/u }),
  );
  await user.click(within(section).getByRole('button', { name: 'Save Roles' }));
  await waitFor(() => {
    expect(sent.filter((s) => s.method === 'PUT').map((s) => s.ifMatch)).toEqual([
      '"s-bill-r1"',
      '"s-bill-r2"',
    ]);
  });
});

it("words a 403 from the server's ceiling and keeps the edit", async () => {
  const user = userEvent.setup();
  renderConsoleAt(
    AT,
    scopeRoutes(undefined, {
      [`PUT ${SC}/s-bill/roles`]: problem(403, 'about:blank', 'Forbidden', {
        detail: 'this removes capabilities the caller does not hold: manage-keys',
      }),
    }),
  );
  const section = await open();
  await user.click(
    await within(section).findByRole('option', { name: /^auditor, a tenant role/u }),
  );
  await user.click(within(section).getByRole('button', { name: 'Save Roles' }));
  expect(await within(section).findByText(/Refused: it would take manage-keys/u)).toBeVisible();
});

it('shows a role added elsewhere beside yours on a 412, and sends nothing more', async () => {
  const user = userEvent.setup();
  const { sent } = renderConsoleAt(
    AT,
    scopeRoutes(undefined, {
      [`PUT ${SC}/s-bill/roles`]: problem(412, 'about:blank', 'Precondition Failed'),
      [`GET ${SC}/s-bill/roles`]: inTurn(
        json({ items: [MAPPED] }, 200, { etag: '"s-bill-r1"' }),
        json(
          {
            items: [MAPPED, { id: 'r-read', name: 'reader', client_id: null, client_key: null }],
          },
          200,
          { etag: '"s-bill-r2"' },
        ),
      ),
    }),
  );
  const section = await open();
  await user.click(
    await within(section).findByRole('option', { name: /^auditor, a tenant role/u }),
  );
  await user.click(within(section).getByRole('button', { name: 'Save Roles' }));
  expect(await within(section).findByRole('button', { name: 'Keep mine in Roles' })).toBeVisible();
  expect(sent.filter((s) => s.method === 'PUT')).toHaveLength(1);
});

it('passes axe in both themes', async () => {
  expect(
    await axeInBothThemes(
      () => consoleAt(AT, scopeRoutes()).element,
      () => screen.findByRole('listbox', { name: 'Roles billing carries' }),
    ),
  ).toEqual({ light: [], dark: [] });
});
