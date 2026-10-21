import Link from '@docusaurus/Link';
import type { ReactElement } from 'react';
import { JOURNEYS, SECTIONS } from '@site/nav';
import { useAssetUrls } from '@site/src/features/landing/usecase/useAssetUrls';
import { Section } from '@site/src/features/landing/view/Section/Section';
import styles from '@site/src/features/landing/view/Browse/Browse.module.css';

export function Browse(): ReactElement {
  const { llms } = useAssetUrls();
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
              <Link className={styles.row} to={`/${section.route}`}>
                <span className={styles.rowLabel}>{section.label}</span>
                <span className={styles.rowSummary}>{section.summary}</span>
              </Link>
            </li>
          ))}
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
                  <Link className={styles.inline} to={`/${journey.route}`}>
                    {journey.label}
                  </Link>
                </li>
              ))}
            </ol>
          </div>
          <div data-reveal="" className={styles.pane} data-section="agents">
            <h3 className={styles.cardTitle}>For AI assistants</h3>
            <p className={styles.cardBody}>
              Every page of this site is also plain Markdown, and <a href={llms}>llms.txt</a> lists
              them all, so an assistant can read the documentation without scraping it. An MCP
              server, which would let an agent administer Odudu through the same checks as everyone
              else, is planned (P5a) and is not built yet.{' '}
              <Link to="/roadmap/#next">See where it sits on the roadmap.</Link>
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
