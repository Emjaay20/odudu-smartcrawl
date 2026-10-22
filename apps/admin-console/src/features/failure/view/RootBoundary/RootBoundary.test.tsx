import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { RootBoundary } from '#/features/failure/view/RootBoundary';
import { axeInBothThemes } from '#/testing/axeInBothThemes';

afterEach(() => {
  vi.restoreAllMocks();
});

function Throws({ error }: { error: unknown }): ReactNode {
  throw error;
}

it('shows what it wraps while nothing has failed, and reads no route', () => {
  const route = vi.fn(() => '/');
  render(
    <RootBoundary route={route}>
      <p>the console</p>
    </RootBoundary>,
  );
  expect(screen.getByText('the console')).toBeVisible();
  expect(route).not.toHaveBeenCalled();
});

it('shows the standalone fallback for anything thrown, a non-error included', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  render(
    <RootBoundary route={() => '/$tenant'}>
      <Throws error="a thrown string" />
    </RootBoundary>,
  );
  expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
  expect(screen.getByRole('region', { name: 'error details' })).toHaveTextContent('Page: /$tenant');
});

it('shows it for a thrown undefined too, which is still a failure', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  render(
    <RootBoundary route={() => '/'}>
      <Throws error={undefined} />
    </RootBoundary>,
  );
  expect(screen.getByRole('alert')).toBeVisible();
});

it('passes axe in both themes', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  expect(
    await axeInBothThemes(() => (
      <RootBoundary route={() => '/'}>
        <Throws error={new Error('x')} />
      </RootBoundary>
    )),
  ).toEqual({ light: [], dark: [] });
});
