import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';
import type { Answer } from '#/testing/fakeTransport';
import { renderConsoleAt } from '#/testing/renderConsole';
import { ACME_ADMIN } from '#/testing/tenantPaths';

// A record page's Activity tab asks the audit trail for that record alone.
export async function expectOwnActivity(
  at: string,
  routes: Record<string, Answer>,
  record: { noun: string; id: string },
): Promise<void> {
  const user = userEvent.setup();
  const { sent } = renderConsoleAt(at, routes);
  await user.click(await screen.findByRole('tab', { name: 'Activity' }));
  expect(await screen.findByText(`No activity on this ${record.noun} yet`)).toBeVisible();
  await waitFor(() => {
    const read = sent.find((s) => s.path === `${ACME_ADMIN}/audit`);
    expect(read?.search.get('resource_type')).toBe(record.noun);
    expect(read?.search.get('resource_id')).toBe(record.id);
  });
}
