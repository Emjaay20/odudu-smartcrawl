import type { ReactNode } from 'react';
import { BrandLine } from '#/shared/view/BrandLine';
import styles from '#/shared/view/LostFrame/LostFrame.module.css';

// A screen the console draws outside its frame, because there is no tenant
// or no page to frame: the product still names itself above it.
export function LostFrame({ brand, children }: { brand: string; children: ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className={styles.lost}>
      <p className={styles.brand}>
        <BrandLine>{brand}</BrandLine>
      </p>
      {children}
    </main>
  );
}
