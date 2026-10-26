import { DocsLink } from '@site/src/shared/view/DocsLink/DocsLink';
import type { ReactElement } from 'react';
import { JOURNEYS, SECTIONS } from '@site/nav';
import { Section } from '@site/src/features/landing/view/Section/Section';
import styles from '@site/src/features/landing/view/Browse/Browse.module.css';

export function Browse(): ReactElement {
  return (
    <Section
      id="home-browse"
      kicker="The documentation"
      title="Everything else is a click away"
      tone="sunken"
    >
      <div className={styles.pair}>
        <ul className={styles.rows}>
          {SECTIONS.map((section) => (
            <li key={section.id} data-reveal="">
              <DocsLink className={styles.row} to={section.route}>
                <span className={styles.rowLabel}>{section.label}</span>
                <span className={styles.rowSummary}>{section.summary}</span>
              </DocsLink>
            </li>
          ))}
          <li data-reveal="">
            <DocsLink className={styles.row} to="/" data-docs-home="">
              <span className={styles.rowLabel}>Documentation home</span>
              <span className={styles.rowSummary}>
                Every section and the four journeys on one page.
              </span>
            </DocsLink>
          </li>
        </ul>
        <div className={styles.stack}>
          <div data-reveal="" className={styles.pane}>
            <h3 className={styles.cardTitle}>Four journeys, in order</h3>
            <p className={styles.cardBody}>
              Each follows one path with real requests, and links to the full recording.
            </p>
            <ol className={styles.journeys}>
              {JOURNEYS.map((journey) => (
                <li key={journey.route}>
                  <DocsLink className={styles.inline} to={journey.route}>
                    {journey.label}
                  </DocsLink>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </Section>
  );
}
