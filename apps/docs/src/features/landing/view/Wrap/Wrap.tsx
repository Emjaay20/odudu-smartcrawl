import type { ReactElement, ReactNode } from 'react';
import styles from '@site/src/features/landing/view/Wrap/Wrap.module.css';

interface Props {
  readonly className?: string;
  readonly children: ReactNode;
}

// The page's column: the widest a band's content goes, with a gutter at each side.
export function Wrap({ className, children }: Props): ReactElement {
  return (
    <div className={className === undefined ? styles.wrap : [styles.wrap, className].join(' ')}>
      {children}
    </div>
  );
}
