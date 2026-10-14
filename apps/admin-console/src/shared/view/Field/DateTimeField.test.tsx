import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { I18nProvider } from 'react-aria-components';
import { describe, expect, it } from 'vitest';
import { DateTimeField } from '#/shared/view/Field/DateTimeField';
import { at } from '#/testing/at';
import { axeInBothThemes } from '#/testing/axeInBothThemes';

function Controlled({
  start = '',
  edge = 'start',
  error,
}: {
  start?: string;
  edge?: 'start' | 'end';
  error?: string;
}) {
  const [value, setValue] = useState(start);
  return (
    <I18nProvider locale="en-US">
      <DateTimeField
        label="From"
        description="Events at or after this time."
        edge={edge}
        zone="Africa/Lagos"
        value={value}
        onChange={setValue}
        error={error}
      />
      <output aria-label="Stored">{value}</output>
    </I18nProvider>
  );
}

function stored(): string {
  return screen.getByLabelText('Stored').textContent;
}

describe('DateTimeField', () => {
  it('shows an instant as the zone reads it, and names the zone', () => {
    render(<Controlled start="2026-09-28T13:41:00.000Z" />);
    const group = screen.getByRole('group', { name: 'From' });
    const read = within(group)
      .getAllByRole('spinbutton')
      .map((segment) => segment.textContent);
    expect(read.slice(0, 5)).toEqual(['9', '28', '2026', '14', '41']);
    expect(group).toHaveTextContent('GMT+1');
    expect(screen.getByText(/In Africa\/Lagos \(UTC\+01:00\)/u)).toBeVisible();
  });

  it('stores a picked minute as a UTC instant, once every part is given', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    const first = at(screen.getAllByRole('spinbutton'), 0);
    await user.click(first);
    await user.keyboard('09282026');
    expect(stored()).toBe('');
    await user.keyboard('1441');
    expect(stored()).toBe('2026-09-28T13:41:00.000Z');
  });

  it('stores the end of the minute for an upper bound', async () => {
    const user = userEvent.setup();
    render(<Controlled edge="end" />);
    const first = at(screen.getAllByRole('spinbutton'), 0);
    await user.click(first);
    await user.keyboard('092820261441');
    expect(stored()).toBe('2026-09-28T13:41:59.999Z');
  });

  it('puts an error under the field', () => {
    render(<Controlled error="To is before From." />);
    expect(screen.getByRole('group', { name: 'From' })).toHaveAttribute('data-invalid');
    expect(screen.getByText('To is before From.')).toBeVisible();
  });

  it('has no accessibility violations in either theme', async () => {
    expect(
      await axeInBothThemes(() => <Controlled start="2026-09-28T13:41:00.000Z" error="Wrong." />),
    ).toEqual({ light: [], dark: [] });
  });
});
