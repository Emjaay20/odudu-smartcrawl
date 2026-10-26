import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { LoadMore, LoadMoreFailed } from '#/shared/view/LoadMore';
import { axeInBothThemes } from '#/testing/axeInBothThemes';

it('names what it loads, presses once, and says when it is busy', async () => {
  const user = userEvent.setup();
  const onPress = vi.fn();
  const { rerender } = render(<LoadMore noun="deliveries" loading={false} onPress={onPress} />);
  await user.click(screen.getByRole('button', { name: 'Load more deliveries' }));
  expect(onPress).toHaveBeenCalledOnce();
  rerender(<LoadMore noun="deliveries" loading onPress={onPress} />);
  expect(screen.getByRole('button', { name: 'Loading more deliveries…' })).toBeDisabled();
});

it('says the list is full instead of offering a button when limited', () => {
  render(<LoadMore noun="groups" loading={false} onPress={vi.fn()} limited />);
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.getByText(/Narrow it to see further/u)).toBeVisible();
});

it('is the small quiet button when compact, the regular one otherwise', () => {
  const { rerender } = render(<LoadMore noun="groups" loading={false} onPress={vi.fn()} />);
  const button = screen.getByRole('button');
  expect(button).toHaveAttribute('data-size', 'regular');
  expect(button).toHaveAttribute('data-variant', 'secondary');
  rerender(<LoadMore noun="groups" loading={false} onPress={vi.fn()} compact />);
  expect(button).toHaveAttribute('data-size', 'small');
  expect(button).toHaveAttribute('data-variant', 'quiet');
});

it('says a further page could not be loaded, and what to press', () => {
  render(<LoadMoreFailed noun="activity" />);
  expect(screen.getByRole('alert')).toHaveTextContent(
    'More activity could not be loaded. Load more tries again.',
  );
});

it('has no accessibility violations in either theme', async () => {
  expect(
    await axeInBothThemes(() => (
      <>
        <LoadMore noun="groups" loading={false} onPress={vi.fn()} compact />
        <LoadMoreFailed noun="groups" />
      </>
    )),
  ).toEqual({ light: [], dark: [] });
});
