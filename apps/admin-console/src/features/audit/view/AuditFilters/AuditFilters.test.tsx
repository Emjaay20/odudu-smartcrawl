import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { EMPTY_DRAFT } from '#/features/audit/service';
import type { AuditFilterForm } from '#/features/audit/usecase/useAuditPage';
import { AuditFilters } from '#/features/audit/view/AuditFilters/AuditFilters';
import { axeInBothThemes } from '#/testing/axeInBothThemes';

function form(overrides: Partial<AuditFilterForm> = {}): AuditFilterForm {
  return {
    draft: EMPTY_DRAFT,
    problems: {},
    set: vi.fn(),
    submit: vi.fn(),
    clear: vi.fn(),
    filtered: false,
    ...overrides,
  };
}

it('offers every filter the API takes, each labelled', () => {
  render(<AuditFilters form={form()} />);
  for (const name of ['Action', 'Resource type', 'Resource id', 'Actor (subject id)']) {
    expect(screen.getByRole('textbox', { name })).toBeVisible();
  }
  for (const name of ['Event type', 'Outcome']) {
    expect(screen.getByRole('button', { name: new RegExp(name, 'u') })).toBeVisible();
  }
  for (const name of ['From', 'To']) {
    expect(screen.getByRole('group', { name })).toBeVisible();
  }
});

it('says what is not a filter, rather than offering it', () => {
  render(<AuditFilters form={form()} />);
  expect(screen.getByText(/request id, the address a request came from/u)).toBeVisible();
  expect(screen.queryByRole('textbox', { name: /request/iu })).toBeNull();
});

it('keeps the resource id out of reach until the draft has a resource type', () => {
  const { rerender } = render(<AuditFilters form={form()} />);
  expect(screen.getByRole('textbox', { name: 'Resource id' })).toBeDisabled();
  rerender(<AuditFilters form={form({ draft: { ...EMPTY_DRAFT, resource_type: 'client' } })} />);
  expect(screen.getByRole('textbox', { name: 'Resource id' })).toBeEnabled();
});

it('submits the form from the keyboard, and offers Clear only when there is something to clear', async () => {
  const user = userEvent.setup();
  const held = form();
  const { rerender } = render(<AuditFilters form={held} />);
  expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  await user.type(screen.getByRole('textbox', { name: 'Action' }), '{Enter}');
  expect(held.submit).toHaveBeenCalledOnce();
  rerender(<AuditFilters form={form({ filtered: true })} />);
  expect(screen.getByRole('button', { name: 'Clear filters' })).toBeVisible();
});

it('puts each problem beside its field', () => {
  render(
    <AuditFilters
      form={form({
        draft: { ...EMPTY_DRAFT, actor_subject_id: 'grace' },
        problems: { actor_subject_id: 'A subject id is a UUID.', to: 'To is before From.' },
      })}
    />,
  );
  expect(screen.getByText('A subject id is a UUID.')).toBeVisible();
  expect(screen.getByText('To is before From.')).toBeVisible();
});

it('passes axe in both themes, clean and with problems', async () => {
  expect(await axeInBothThemes(() => <AuditFilters form={form()} />)).toEqual({
    light: [],
    dark: [],
  });
  expect(
    await axeInBothThemes(() => (
      <AuditFilters
        form={form({
          filtered: true,
          draft: { ...EMPTY_DRAFT, actor_subject_id: 'grace', resource_type: 'client' },
          problems: { actor_subject_id: 'A subject id is a UUID.' },
        })}
      />
    )),
  ).toEqual({ light: [], dark: [] });
});
