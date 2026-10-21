import type { ReactNode } from 'react';
import { BrandLine } from '#/shared/view/BrandLine';
import styles from '#/features/session/view/SessionStatus/SessionStatus.module.css';

// The page shown while the session is read, or while the window leaves for a
// tenant's sign-in: a heading, and what is happening in words.
export function SessionStatus({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className={styles.page}>
      <div className={styles.panel}>
        <p className={styles.brand}>
          <BrandLine>Odudu console</BrandLine>
        </p>
        <h1 className={styles.title}>{title}</h1>
        {children}
      </div>
    </main>
  );
}
