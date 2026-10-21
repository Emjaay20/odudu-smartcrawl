import type { ReactElement, ReactNode } from 'react';
import { Wrap } from '@site/src/features/landing/view/Wrap/Wrap';
import styles from '@site/src/features/landing/view/Section/Section.module.css';

interface Props {
  readonly id: string;
  readonly kicker: string;
  readonly title: string;
  readonly section?: string;
  readonly tone?: 'plain' | 'sunken';
  readonly children: ReactNode;
}

// One band of the landing page: a kicker, a heading and its content.
export function Section({
  id,
  kicker,
  title,
  section,
  tone = 'plain',
  children,
}: Props): ReactElement {
  return (
    <section
      className={tone === 'sunken' ? styles.bandSunken : styles.band}
      aria-labelledby={id}
      data-section={section}
    >
      <Wrap>
        <div data-reveal="heading">
          <p className={styles.kicker}>{kicker}</p>
          <h2 id={id} className={styles.heading}>
            {title}
          </h2>
        </div>
        {children}
      </Wrap>
    </section>
  );
}
