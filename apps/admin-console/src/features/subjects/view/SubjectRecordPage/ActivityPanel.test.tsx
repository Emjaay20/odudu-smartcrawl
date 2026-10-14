import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { axeInBothThemes } from '#/testing/axeInBothThemes';
import { json, problem } from '#/testing/fakeTransport';
import { consoleAt, renderConsoleAt, resetConsole, ACME_ADMIN } from '#/testing/renderConsole';
import { ADA_AT, ADA_ID, subjectRoutes } from '#/testing/subjectsFixtures';

afterEach(() => {
  resetConsole();
  sessionStorage.clear();
});

const AT = `${ADA_AT}?tab=activity`;
const EVENT = {
  id: 'e1',
  occurred_at: '2026-09-28T08:00:00.000Z',
  event_type: 'admin_mutation',
  action: 'subject.amend',
  outcome: 'allowed',
  actor_tenant_id: 't',
  actor_subject_id: 's1',
  actor_client_id: null,
  actor_name: 'grace',
  actor_origin: 'tenant',
  resource_type: 'subject',
  resource_id: ADA_ID,
  request_id: null,
  ip: null,
  detail: {},
};

it('lists the audit rows filed on the subject, naming each actor', async () => {
  const { sent } = renderConsoleAt(
    AT,
    subjectRoutes(undefined, { [`GET ${ACME_ADMIN}/audit`]: json({ items: [EVENT] }) }),
  );
  const table = await screen.findByRole('grid', { name: 'Activity on this subject' });
  const [, row] = within(table).getAllByRole('row');
  expect(row).toHaveTextContent('subject.amend');
  expect(row).toHaveTextContent('grace');
  await waitFor(() => {
    expect(sent.find((s) => s.path === `${ACME_ADMIN}/audit`)?.search.toString()).toBe(
      `resource_type=subject&resource_id=${ADA_ID}`,
    );
  });
  expect(screen.getByText(/sign-ins are filed under the session they began/u)).toBeVisible();
});

it('names view-audit when the trail is refused', async () => {
  renderConsoleAt(
    AT,
    subjectRoutes(undefined, {
      [`GET ${ACME_ADMIN}/audit`]: problem(403, 'about:blank', 'Forbidden'),
    }),
  );
  expect(await screen.findByText(/Activity needs the/u)).toHaveTextContent(
    'Activity needs the view-audit capability.',
  );
});

it('passes axe in both themes', async () => {
  expect(
    await axeInBothThemes(
      () =>
        consoleAt(
          AT,
          subjectRoutes(undefined, { [`GET ${ACME_ADMIN}/audit`]: json({ items: [EVENT] }) }),
        ).element,
      () => screen.findByRole('grid', { name: 'Activity on this subject' }),
    ),
  ).toEqual({ light: [], dark: [] });
});
