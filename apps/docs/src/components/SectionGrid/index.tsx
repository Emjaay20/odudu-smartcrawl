import Link from '@docusaurus/Link';
import { SECTIONS } from '@site/nav';
import type { ReactNode } from 'react';
import styles from '@site/src/components/SectionGrid/styles.module.css';

export default function SectionGrid(): ReactNode {
  return (
    <ul className={styles.grid}>
      {SECTIONS.map((section) => (
        <li key={section.id} className={styles.item}>
          <Link className={styles.card} to={`/${section.route}`}>
            <span className={styles.label}>{section.label}</span>
            <span className={styles.summary}>{section.summary}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
