import type { ReactElement, ReactNode } from 'react';

// Head's children render in place, so a test can read the tags it would hoist.
export default function Head({ children }: { readonly children?: ReactNode }): ReactElement {
  return <head data-hoisted="">{children}</head>;
}
