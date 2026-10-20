import Link from '@docusaurus/Link';
import { JOURNEYS, SECTIONS, START_ROUTES } from '@site/nav';
import type { ReactNode } from 'react';
import styles from '@site/src/components/HomeMap/styles.module.css';

function sectionOf(route: string): (typeof SECTIONS)[number] {
  const found = SECTIONS.find((candidate) => candidate.route === route);
  if (found === undefined) throw new Error(`nav.ts has no section at ${route}`);
  return found;
}

const START = START_ROUTES.map(sectionOf);
const GUIDES = sectionOf('guides/');
const DEEPER = SECTIONS.filter(
  (section) => section !== GUIDES && !START_ROUTES.includes(section.route),
);

// Where to begin, then the journeys in the order to read them, then the rest.
export default function HomeMap(): ReactNode {
  return (
    <div className={styles.map}>
      <section aria-labelledby="home-start">
        <h2 id="home-start" className={styles.heading}>
          Start here
        </h2>
        <ul className={styles.start}>
          {START.map((section, index) => (
            <li key={section.id}>
              <Link
                className={[styles.card, index === 0 ? styles.primary : undefined].join(' ')}
                to={`/${section.route}`}
              >
                <span className={styles.label}>{section.label}</span>
                <span className={styles.summary}>{section.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="home-journeys">
        <h2 id="home-journeys" className={styles.heading}>
          Follow a journey
        </h2>
        <p className={styles.lede}>
          Four short guides, in order. Each one shows real requests and links to the full recording.{' '}
          <Link to={`/${GUIDES.route}`}>All guides</Link>
        </p>
        <ol className={styles.journeys}>
          {JOURNEYS.map((journey) => (
            <li key={journey.route}>
              <Link className={styles.card} to={`/${journey.route}`}>
                <span className={styles.label}>{journey.label}</span>
                <span className={styles.summary}>{journey.summary}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="home-deeper">
        <h2 id="home-deeper" className={styles.heading}>
          Understand it, run it, look it up
        </h2>
        <ul className={styles.deeper}>
          {DEEPER.map((section) => (
            <li key={section.id}>
              <Link className={styles.row} to={`/${section.route}`}>
                <span className={styles.label}>{section.label}</span>
                <span className={styles.summary}>{section.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
