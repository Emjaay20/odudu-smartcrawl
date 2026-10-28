import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { axeInBothThemes } from '#/testing/axeInBothThemes';
import { DEFAULT_PREVIEW } from '#/features/branding/service';
import type { Preview } from '#/features/branding/usecase/usePreview';
import { PreviewPane } from '#/features/branding/view/PreviewPane';

function preview(changes: Partial<Preview> = {}): Preview {
  return {
    choice: DEFAULT_PREVIEW,
    src: '/console/api/admin/tenants/acme/theme/preview?kind=sign-in&scheme=light',
    frameKey: 'k',
    note: null,
    loading: false,
    onLoaded: () => undefined,
    setKind: () => undefined,
    setScheme: () => undefined,
    ...changes,
  };
}

it('frames the address it is given, allowing nothing', () => {
  render(<PreviewPane preview={preview()} pickKind />);
  const frame = screen.getByTitle('Preview of the page');
  expect(frame).toHaveAttribute('sandbox', '');
  expect(frame).toHaveAttribute('src', preview().src);
});

it('says the preview is loading, and hides the frame meanwhile', () => {
  render(<PreviewPane preview={preview({ loading: true })} pickKind />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading the preview');
});

it('offers the page picker only where the editor does not', () => {
  const { rerender } = render(<PreviewPane preview={preview()} pickKind />);
  expect(screen.getByRole('button', { name: /Page/u })).toBeVisible();
  rerender(<PreviewPane preview={preview()} pickKind={false} />);
  expect(screen.queryByRole('button', { name: /Page/u })).toBeNull();
});

it('has nothing axe can find in either theme', async () => {
  const found = await axeInBothThemes(
    () => <PreviewPane preview={preview({ note: 'Left out.' })} pickKind />,
    () => Promise.resolve(),
    { frames: false },
  );
  expect(found).toEqual({ light: [], dark: [] });
});
