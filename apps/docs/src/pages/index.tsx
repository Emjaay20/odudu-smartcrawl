import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import { JOURNEYS, REPOSITORY_URL, SECTIONS } from '@site/nav';
import { landingJsonLd } from '@site/seo';
import mono400 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2';
import sans400 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2';
import sans600 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2';
import ConsoleShot from '@site/src/components/ConsoleShot';
import CardList from '@site/src/components/Landing/CardList';
import {
  CAPABILITIES,
  EXAMPLES,
  EXAMPLES_URL_PATH,
  LICENSING_URL_PATH,
  READERS,
  STEPS,
} from '@site/src/components/Landing/content';
import Install from '@site/src/components/Landing/Install';
import SignInFlow from '@site/src/components/Landing/SignInFlow';
import Section from '@site/src/components/Landing/Section';
import useReveal from '@site/src/components/Landing/useReveal';
import type { ReactNode } from 'react';
import styles from '@site/src/pages/home.module.css';

function Hero(): ReactNode {
  return (
    <header className={styles.hero}>
      <div className={[styles.wrap, styles.heroGrid].join(' ')}>
        <div className={styles.heroText}>
          <span className={styles.lockup} role="img" aria-label="Odudu" />
          <h1 className={styles.title}>An identity provider you run yourself</h1>
          <p className={styles.lede}>
            Odudu is an OpenID Connect and OAuth 2.0 server with an admin console, a command-line
            tool and documentation checked against the running server. It is one container and
            Postgres, and it is open source.
          </p>
          <Install />
          <p className={styles.actions}>
            <Link className={styles.primary} to="/introduction/">
              Read the docs
            </Link>
            <Link className={styles.secondary} to="/quick-start/">
              Follow the quick start
            </Link>
          </p>
          <p className={styles.early}>
            Early software, not ready for production.{' '}
            <Link to="/roadmap/">What is built and what is next</Link>
          </p>
        </div>
        <div className={styles.heroShot}>
          <ConsoleShot
            name="overview"
            priority
            alt="The Odudu admin console on a tenant's overview page: a menu of areas on the left, and counts of subjects, clients, groups, roles and scopes."
            caption="The admin console, on a tenant's overview."
          />
        </div>
      </div>
    </header>
  );
}

function Steps(): ReactNode {
  return (
    <Section
      id="home-steps"
      kicker="First run"
      title="From docker compose up to your first sign-in"
      tone="sunken"
    >
      <ol className={styles.steps}>
        {STEPS.map((step) => (
          <li key={step.title} className={styles.step} data-reveal="">
            <h3 className={styles.cardTitle}>{step.title}</h3>
            <p className={styles.cardBody}>{step.body}</p>
          </li>
        ))}
      </ol>
      <p className={styles.after} data-reveal="">
        <Link className={styles.inline} to="/quick-start/">
          The quick start
        </Link>{' '}
        has every step, with what you should see.
      </p>
    </Section>
  );
}

function Ways(): ReactNode {
  return (
    <Section id="home-readers" kicker="Start where you are" title="Four ways in" section="readers">
      <CardList cards={READERS} columns={4} />
      <div className={styles.examples} data-section="examples" data-reveal="">
        <h3 className={styles.cardTitle}>Four small apps that work</h3>
        <ul className={styles.exampleList}>
          {EXAMPLES.map((example) => (
            <li key={example.to}>
              <Link to={example.to}>{example.title}</Link>
            </li>
          ))}
        </ul>
        <p className={styles.cardBody}>
          Each has a guide that walks through it. The source is in the{' '}
          <a
            href={`${REPOSITORY_URL}${EXAMPLES_URL_PATH}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            examples folder<span className="visually-hidden"> (opens in a new tab)</span>
          </a>
          .
        </p>
      </div>
    </Section>
  );
}

function Compare(): ReactNode {
  return (
    <Section
      id="home-compare"
      kicker="How it compares"
      title="Honest about where it stands"
      section="compare"
      tone="sunken"
    >
      <p className={styles.sectionLede} data-reveal="">
        You may be choosing between Odudu and another identity provider you run yourself. The
        comparison page lists what Odudu does today, each with a page that shows it working, and
        what it does not do. It says nothing about other products, because facts about them go
        stale.
      </p>
      <p className={styles.callout} data-reveal="">
        <strong>Odudu is not ready for production.</strong> It has not been security reviewed and it
        runs as one instance. The roadmap lists what is built, what comes next and what is decided
        against.
      </p>
      <p className={styles.links} data-reveal="">
        <Link className={styles.inline} to="/introduction/compare/">
          How Odudu compares
        </Link>
        <Link className={styles.inline} to="/guides/keycloak/">
          Coming from Keycloak
        </Link>
        <Link className={styles.inline} to="/roadmap/">
          The roadmap
        </Link>
      </p>
    </Section>
  );
}

function Where(): ReactNode {
  const sansLicence = useBaseUrl('/licenses/IBM-Plex-Sans-OFL-1.1.txt');
  const monoLicence = useBaseUrl('/licenses/IBM-Plex-Mono-OFL-1.1.txt');
  return (
    <Section id="home-where" kicker="Where it runs" title="Self-hosted today, hosted in the works">
      <div className={styles.pair}>
        <div data-reveal="" className={styles.pane}>
          <h3 className={styles.cardTitle}>Run it yourself</h3>
          <p className={styles.cardBody}>
            This is what exists. Odudu is one container beside Postgres, and the quick start has it
            running on your machine with the console open.{' '}
            <Link to="/operating/">Operating Odudu</Link> covers a server other people can reach.
          </p>
        </div>
        <div data-reveal="" className={styles.pane} data-section="hosted">
          <h3 className={styles.cardTitle}>
            Hosted Odudu <span className={styles.badge}>In the works</span>
          </h3>
          <p className={styles.cardBody}>
            A hosted Odudu, run for you, is in the works. It has no date. Nothing in the open source
            server waits for it. <Link to="/roadmap/">Read the roadmap</Link>
          </p>
        </div>
      </div>
      <p className={styles.after} data-reveal="" data-section="licence">
        Free software: the server, the console and the command-line tool are AGPL-3.0, and the
        documentation text and the examples are Apache-2.0. An app that only talks to Odudu over
        OpenID Connect or the admin API is not a derivative work of it.{' '}
        <a href={`${REPOSITORY_URL}${LICENSING_URL_PATH}`}>How the licences fit together</a>. The
        fonts are IBM Plex Sans and Mono under the SIL Open Font License 1.1 (
        <a href={sansLicence}>Sans</a>, <a href={monoLicence}>Mono</a>)
      </p>
    </Section>
  );
}

function Browse(): ReactNode {
  const llms = useBaseUrl('/llms.txt');
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

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  const motion = useReveal();
  return (
    <Layout
      title="A self-hosted OpenID Connect identity provider"
      description="Odudu is an OpenID Connect and OAuth 2.0 identity provider you run yourself: one container and Postgres, an admin console and a command-line tool."
    >
      <Head>
        {[sans400, sans600, mono400].map((href) => (
          <link
            key={href}
            rel="preload"
            as="font"
            type="font/woff2"
            href={href}
            crossOrigin="anonymous"
          />
        ))}
        <script type="application/ld+json">
          {landingJsonLd(`${siteConfig.url}${siteConfig.baseUrl}`)}
        </script>
      </Head>
      <main className={styles.page} data-page="landing" data-motion={motion ? 'ok' : undefined}>
        <Hero />
        <Section
          id="home-flow"
          kicker="In pictures"
          title="How sign-in works"
          section="signin"
          tone="sunken"
        >
          <p className={styles.sectionLede} data-reveal="">
            Odudu keeps sign-in in one place, so your apps never handle a password.
          </p>
          <SignInFlow />
        </Section>
        <Section
          id="home-capabilities"
          kicker="What you get"
          title="A complete sign-in service, built and shown working"
          section="capabilities"
        >
          <CardList cards={CAPABILITIES} columns={4} />
        </Section>
        <Steps />
        <Ways />
        <Compare />
        <Where />
        <Browse />
      </main>
    </Layout>
  );
}
