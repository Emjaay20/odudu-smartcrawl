import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';
import { whoamiReads, type Answer } from '#/testing/fakeTransport';
import { renderConsoleAt } from '#/testing/renderConsole';

// A confirmed action the server refuses keeps its dialog open with the reason,
// the console asks again what the caller holds, and cancelling then asking
// afresh shows the dialog clean.
export async function expectRefusedThenCancelled(
  at: string,
  routes: Record<string, Answer>,
  { open, confirm }: { open: string; confirm: string },
): Promise<void> {
  const user = userEvent.setup();
  const { sent } = renderConsoleAt(at, routes);
  await user.click(await screen.findByRole('button', { name: open }));
  const dialog = await screen.findByRole('alertdialog');
  await user.click(within(dialog).getByRole('button', { name: confirm }));
  expect(await within(dialog).findByRole('alert')).toBeVisible();
  expect(whoamiReads(sent)).toBeGreaterThan(1);
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => {
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
  await user.click(screen.getByRole('button', { name: open }));
  const again = await screen.findByRole('alertdialog');
  expect(within(again).queryByRole('alert')).toBeNull();
}
