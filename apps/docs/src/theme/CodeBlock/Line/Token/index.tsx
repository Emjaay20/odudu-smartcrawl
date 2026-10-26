import type { ReactElement, ReactNode } from 'react';

interface Props {
  className?: string;
  children?: ReactNode;
}

// A piece of plain text needs no element of its own.
export default function CodeBlockLineToken({ className, children }: Props): ReactElement {
  return className === undefined ? <>{children}</> : <span className={className}>{children}</span>;
}
