import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AssignedList, AssignedRow, AssignPanel } from '#/shared/view/AssignmentControls';
import { axeInBothThemes } from '#/testing/axeInBothThemes';

function panel(overrides: Partial<Parameters<typeof AssignPanel>[0]> = {}) {
  return (
    <AssignPanel
      title="Assign to a client"
      assignment="default"
      onAssignment={vi.fn()}
      label="Assign to Billing"
      disabled={false}
      onAssign={vi.fn(() => Promise.resolve(true))}
      {...overrides}
    >
      <p>the picker</p>
    </AssignPanel>
  );
}

function rows(row: Partial<Parameters<typeof AssignedRow>[0]> = {}) {
  return (
    <AssignedList label="Scopes assigned to Billing">
      <AssignedRow
        name={<code>billing</code>}
        assignment={{ label: 'Assignment of billing', value: 'optional', onChange: vi.fn() }}
        working={false}
        remove={{ verb: 'Remove', target: 'billing', onRemove: vi.fn(() => Promise.resolve(true)) }}
        {...row}
      />
    </AssignedList>
  );
}

it('is a region named for what it assigns, holding the picker it was given', () => {
  render(panel());
  const region = screen.getByRole('region', { name: 'Assign to a client' });
  expect(within(region).getByText('the picker')).toBeVisible();
});

it('offers both ways to assign, and says which one is chosen', () => {
  render(panel({ assignment: 'optional' }));
  expect(screen.getByRole('button', { name: /Assign it as/u })).toHaveTextContent('Optional');
});

it('presses the button that does it, unless it is disabled', async () => {
  const user = userEvent.setup();
  const onAssign = vi.fn(() => Promise.resolve(true));
  const { rerender } = render(panel({ onAssign }));
  await user.click(screen.getByRole('button', { name: 'Assign to Billing' }));
  expect(onAssign).toHaveBeenCalledOnce();
  rerender(panel({ onAssign, disabled: true }));
  expect(screen.getByRole('button', { name: 'Assign to Billing' })).toBeDisabled();
});

it('does not raise a press the flow already reported as failed', async () => {
  const user = userEvent.setup();
  const raised = vi.fn();
  process.on('unhandledRejection', raised);
  render(panel({ onAssign: () => Promise.reject(new Error('refused')) }));
  await user.click(screen.getByRole('button', { name: 'Assign to Billing' }));
  process.off('unhandledRejection', raised);
  expect(raised).not.toHaveBeenCalled();
});

it('lists an assignment by who it is with, its select, and its remove button', () => {
  render(rows());
  const list = screen.getByRole('list', { name: 'Scopes assigned to Billing' });
  expect(within(list).getByText('billing')).toBeVisible();
  expect(within(list).getByRole('button', { name: /Assignment of billing/u })).toHaveTextContent(
    'Optional',
  );
  expect(within(list).getByRole('button', { name: 'Remove billing' })).toBeVisible();
});

it('says how it is assigned in words where it cannot be changed, and offers no removal', () => {
  render(rows({ assignment: 'default', remove: null }));
  const list = screen.getByRole('list', { name: 'Scopes assigned to Billing' });
  expect(within(list).getByText('default')).toBeVisible();
  expect(within(list).queryByRole('button')).toBeNull();
});

it('hands a change and a removal on, and holds both while another is on its way', async () => {
  const user = userEvent.setup();
  const onRemove = vi.fn(() => Promise.resolve(true));
  const onChange = vi.fn(() => Promise.resolve(true));
  const { rerender } = render(
    rows({
      assignment: { label: 'Assignment of billing', value: 'optional', onChange },
      remove: { verb: 'Unassign', target: 'billing', onRemove },
    }),
  );
  await user.click(screen.getByRole('button', { name: 'Unassign billing' }));
  expect(onRemove).toHaveBeenCalledOnce();
  await user.click(screen.getByRole('button', { name: /Assignment of billing/u }));
  await user.click(await screen.findByRole('option', { name: 'Default' }));
  expect(onChange).toHaveBeenCalledWith('default');
  rerender(rows({ working: true }));
  expect(screen.getByRole('button', { name: 'Remove billing' })).toBeDisabled();
  expect(screen.getByRole('button', { name: /Assignment of billing/u })).toBeDisabled();
});

it('has no accessibility violations in either theme', async () => {
  expect(
    await axeInBothThemes(() => (
      <>
        {panel()}
        {rows()}
      </>
    )),
  ).toEqual({ light: [], dark: [] });
});
