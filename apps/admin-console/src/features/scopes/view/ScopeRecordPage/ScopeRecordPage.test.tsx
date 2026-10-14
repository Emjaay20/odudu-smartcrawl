import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { axeInBothThemes } from '#/testing/axeInBothThemes';
import { problem } from '#/testing/fakeTransport';
import { resetConsole } from '#/testing/resetConsole';
import { ACME_ADMIN } from '#/testing/tenantPaths';
import { consoleAt, renderConsoleAt } from '#/testing/renderConsole';
import { SC, scopeRoutes } from '#/testing/scopesFixtures';

afterEach(() => {
  resetConsole();
  sessionStorage.clear();
});

const AT = '/console/acme/scopes/s-bill';

it('heads the scope by its name with the five tabs, and breadcrumbs back to the list', async () => {
  renderConsoleAt(AT, scopeRoutes());
  expect(await screen.findByRole('heading', { level: 1, name: 'billing' })).toBeVisible();
  const tabs = screen.getByRole('tablist', { name: 'Scope sections' });
  expect(
    within(tabs)
      .getAllByRole('tab')
      .map((tab) => tab.textContent),
  ).toEqual(['General', 'Roles', 'Claim mappers', 'Clients', 'Activity']);
  const trail = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
  expect(trail.getByRole('link', { name: 'Scopes' })).toHaveAttribute(
    'href',
    '/console/acme/scopes',
  );
});

it('offers a copy of the scope, which is a new scope under another name', async () => {
  renderConsoleAt(AT, scopeRoutes());
  expect(await screen.findByRole('link', { name: 'Create a copy' })).toHaveAttribute(
    'href',
    '/console/acme/scopes/new?copy=s-bill',
  );
});

it("reads the scope's own activity", async () => {
  const user = userEvent.setup();
  const { sent } = renderConsoleAt(AT, scopeRoutes());
  await user.click(await screen.findByRole('tab', { name: 'Activity' }));
  expect(await screen.findByText('No activity on this scope yet')).toBeVisible();
  await waitFor(() => {
    const read = sent.find((s) => s.path === `${ACME_ADMIN}/audit`);
    expect(read?.search.get('resource_type')).toBe('scope');
    expect(read?.search.get('resource_id')).toBe('s-bill');
  });
});

it('says there is no such scope for a 404', async () => {
  renderConsoleAt(
    '/console/acme/scopes/s-none',
    scopeRoutes(undefined, { [`GET ${SC}/s-none`]: problem(404) }),
  );
  expect(await screen.findByText('No such scope')).toBeVisible();
});

it('passes axe in both themes, on a tab and refused', async () => {
  expect(
    await axeInBothThemes(
      () => consoleAt(AT, scopeRoutes()).element,
      () => screen.findByRole('region', { name: 'Description' }),
    ),
  ).toEqual({ light: [], dark: [] });
  expect(
    await axeInBothThemes(
      () => consoleAt(AT, scopeRoutes(['manage-clients'])).element,
      () => screen.findByRole('note'),
    ),
  ).toEqual({ light: [], dark: [] });
});
