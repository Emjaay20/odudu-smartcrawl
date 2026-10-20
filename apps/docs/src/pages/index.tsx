import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import { landingJsonLd } from '@site/seo';
import HomeMap from '@site/src/components/HomeMap';
import type { ReactNode } from 'react';
import styles from '@site/src/pages/index.module.css';

// A plain home until the landing page replaces it: the name, the one
// sentence, the first step and then the way through the documentation.
export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title="Odudu documentation"
      description="Odudu is an OpenID Connect identity provider you run yourself. Start with the quick start, then read the guides, concepts, reference and operating notes."
    >
      <Head>
        <script type="application/ld+json">
          {landingJsonLd(`${siteConfig.url}${siteConfig.baseUrl}`)}
        </script>
      </Head>
      <header className={styles.hero} data-page="landing">
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
        <div className={styles.sections}>
          <HomeMap />
        </div>
      </main>
    </Layout>
  );
}
