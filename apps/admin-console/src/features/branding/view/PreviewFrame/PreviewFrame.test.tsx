import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { PreviewFrame } from '#/features/branding/view/PreviewFrame/PreviewFrame';
import { axeInBothThemes } from '#/testing/axeInBothThemes';

const frame = (loading: boolean, onLoaded = () => undefined) => (
  <PreviewFrame title="A preview" src="/x" frameKey="k" loading={loading} onLoaded={onLoaded} />
);

it('frames the address it is given, allowing nothing', () => {
  render(frame(false));
  const iframe = screen.getByTitle('A preview');
  expect(iframe).toHaveAttribute('src', '/x');
  expect(iframe).toHaveAttribute('sandbox', '');
  expect(iframe).toHaveAttribute('referrerpolicy', 'no-referrer');
});

it('says it is loading while it is, and not after', () => {
  const { rerender } = render(frame(true));
  expect(screen.getByRole('status')).toHaveTextContent('Loading the preview');
  rerender(frame(false));
  expect(screen.queryByRole('status')).toBeNull();
});

it('tells when the frame has loaded', () => {
  const onLoaded = vi.fn();
  render(frame(true, onLoaded));
  screen.getByTitle('A preview').dispatchEvent(new Event('load'));
  expect(onLoaded).toHaveBeenCalledOnce();
});

it('has nothing axe can find in either theme', async () => {
  const found = await axeInBothThemes(
    () => frame(false),
    () => Promise.resolve(),
    {
      frames: false,
    },
  );
  expect(found).toEqual({ light: [], dark: [] });
});
