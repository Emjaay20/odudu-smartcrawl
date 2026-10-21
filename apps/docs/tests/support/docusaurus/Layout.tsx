import type { ReactElement, ReactNode } from 'react';

export default function Layout({ children }: { readonly children?: ReactNode }): ReactElement {
  return <div data-layout="">{children}</div>;
}
