import { screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { axeInBothThemes } from '#/testing/axeInBothThemes';
import { json } from '#/testing/fakeTransport';
import { resetConsole } from '#/testing/resetConsole';
import { consoleAt, GRACE, renderConsoleAt, whoami } from '#/testing/renderConsole';
import { ACME_ADMIN } from '#/testing/tenantPaths';

afterEach(() => {
  resetConsole();
});

function areaWith(capabilities: readonly string[]) {
  return {
    'GET /console/api/session': json(GRACE),
    [`GET ${ACME_ADMIN}/whoami`]: whoami(capabilities),
  };
}

it('heads the page with the area, under the tenant', async () => {
  renderConsoleAt('/console/acme/audit', areaWith(['view-audit']));
  expect(await screen.findByRole('heading', { level: 1, name: 'Audit trail' })).toBeVisible();
  expect(
    await screen.findByText('Audit trail is not in this build of the console yet.'),
  ).toBeVisible();
});

it('says which capability the area needs when whoami says it is missing', async () => {
  renderConsoleAt('/console/acme/audit', areaWith([]));
  expect(await screen.findByText(/view-audit/u)).toBeVisible();
});

it('passes axe in both themes, open and refused', async () => {
  for (const capabilities of [['view-audit'], []]) {
    const page = () => consoleAt('/console/acme/audit', areaWith(capabilities));
    expect(
      await axeInBothThemes(
        () => page().element,
        () => screen.findByRole('heading', { level: 1, name: 'Audit trail' }),
      ),
    ).toEqual({ light: [], dark: [] });
  }
});
