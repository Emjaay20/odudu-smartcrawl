import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import { JOURNEYS, REPOSITORY_URL, SECTIONS } from '@site/nav';
import { landingJsonLd } from '@site/seo';
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
    <Section id="home-steps" kicker="First run" title="Ten minutes to a working sign-in">
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

function Console(): ReactNode {
  return (
    <Section
      id="home-console"
      kicker="The console"
      title="Run it with a mouse, or with a script"
      tone="sunken"
    >
      <p className={styles.sectionLede} data-reveal="">
        Every area of a tenant has a page: people, groups, roles, apps, scopes, signing keys, the
        sign-in flow, sessions, mail and the audit trail. The console calls the same admin API your
        scripts can, so a change made in either place is checked and recorded the same way.{' '}
        <Link className={styles.inline} to="/admin-console/tour/">
          Take the tour
        </Link>
      </p>
      <div className={styles.shots} data-reveal="">
        <ConsoleShot
          name="clients"
          alt="A tenant's Clients list in the console: the built-in administration client and one registered app, with a Create a client button."
          caption="Apps registered in a tenant."
        />
        <ConsoleShot
          name="audit"
          alt="The audit trail in the console: a filter bar above a table of events, each with its time, actor and what it did."
          caption="Everything done, and by whom."
        />
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

function Agents(): ReactNode {
  const llms = useBaseUrl('/llms.txt');
  return (
    <Section
      id="home-agents"
      kicker="AI-ready"
      title="Written for assistants as well as people"
      tone="sunken"
      section="agents"
    >
      <div className={styles.pair}>
        <div data-reveal="" className={styles.pane}>
          <h3 className={styles.cardTitle}>Today</h3>
          <p className={styles.cardBody}>
            Every page of this site is also plain Markdown, and <a href={llms}>llms.txt</a> lists
            them all, so an AI assistant can read the documentation without scraping it.
          </p>
        </div>
        <div data-reveal="" className={styles.pane}>
          <h3 className={styles.cardTitle}>Planned</h3>
          <p className={styles.cardBody}>
            An MCP server is planned (P5a): the admin API as tools for an AI agent, read-only by
            default and held to the same capabilities as every other caller. It is not built yet.{' '}
            <Link to="/roadmap/#next">See where it sits on the roadmap.</Link>
          </p>
        </div>
      </div>
    </Section>
  );
}

function Where(): ReactNode {
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
    </Section>
  );
}

function Browse(): ReactNode {
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
      </div>
    </Section>
  );
}

function Licence(): ReactNode {
  return (
    <Section
      id="home-licence"
      kicker="Open source"
      title="Free software, with a clear licence"
      section="licence"
    >
      <p className={styles.sectionLede} data-reveal="">
        The server, the console and the command-line tool are AGPL-3.0. The documentation text and
        the examples are Apache-2.0, so copying a guide or starting from an example is never
        constrained. An app that only talks to Odudu over OpenID Connect or the admin API is not a
        derivative work of it.{' '}
        <a href={`${REPOSITORY_URL}${LICENSING_URL_PATH}`}>How the licences fit together</a>
      </p>
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
        <Console />
        <Steps />
        <Section
          id="home-readers"
          kicker="Start where you are"
          title="Four ways in"
          section="readers"
          tone="sunken"
        >
          <CardList cards={READERS} columns={4} />
        </Section>
        <Section
          id="home-examples"
          kicker="Examples"
          title="Four small apps that work"
          section="examples"
        >
          <CardList cards={EXAMPLES} columns={4} />
          <p className={styles.after} data-reveal="">
            Each has a guide here that walks through it, and its source is in the{' '}
            <a
              href={`${REPOSITORY_URL}${EXAMPLES_URL_PATH}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              examples folder<span className="visually-hidden"> (opens in a new tab)</span>
            </a>
            .
          </p>
        </Section>
        <Compare />
        <Agents />
        <Where />
        <Browse />
        <Licence />
      </main>
    </Layout>
  );
}
