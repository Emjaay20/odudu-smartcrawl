import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import SectionGrid from '@site/src/components/SectionGrid';
import type { ReactNode } from 'react';
import styles from '@site/src/pages/index.module.css';

// A plain home until the landing page replaces it: the name, the one
// sentence, the first step and every section.
export default function Home(): ReactNode {
  return (
    <Layout
      title="Odudu documentation"
      description="Odudu is an OpenID Connect identity provider you run yourself. Start with the quick start, then read the guides, concepts, reference and operating notes."
    >
      <header className={styles.hero}>
        <div className="container">
          <h1 className={styles.title}>Odudu</h1>
          <p className={styles.tagline}>
            An OpenID Connect identity provider you run yourself, with an admin console, a
            command-line tool and documentation that is checked against the running server.
          </p>
          <Link className="button button--primary button--lg" to="/quick-start/">
            Start with the quick start
          </Link>
        </div>
      </header>
      <main className="container">
        <section className={styles.sections}>
          <h2 className={styles.heading}>Documentation</h2>
          <SectionGrid />
        </section>
      </main>
    </Layout>
  );
}
