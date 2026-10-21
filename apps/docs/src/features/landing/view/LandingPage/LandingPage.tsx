import Head from '@docusaurus/Head';
import type { ReactElement } from 'react';
import { CAPABILITIES } from '@site/src/features/landing/service/content';
import { useLandingPage } from '@site/src/features/landing/usecase/useLandingPage';
import { Browse } from '@site/src/features/landing/view/Browse/Browse';
import { CardList } from '@site/src/features/landing/view/CardList/CardList';
import { Compare } from '@site/src/features/landing/view/Compare/Compare';
import { Hero } from '@site/src/features/landing/view/Hero/Hero';
import { FONT_PRELOADS } from '@site/src/features/landing/view/LandingPage/preloads';
import { Section } from '@site/src/features/landing/view/Section/Section';
import { SignInFlow } from '@site/src/features/landing/view/SignInFlow/SignInFlow';
import { Steps } from '@site/src/features/landing/view/Steps/Steps';
import { Ways } from '@site/src/features/landing/view/Ways/Ways';
import { Where } from '@site/src/features/landing/view/Where/Where';
import styles from '@site/src/features/landing/view/LandingPage/LandingPage.module.css';

// The home page's content, under the site's own header and footer.
export function LandingPage(): ReactElement {
  const { motion, jsonLd } = useLandingPage();
  return (
    <>
      <Head>
        {FONT_PRELOADS.map((href) => (
          <link
            key={href}
            rel="preload"
            as="font"
            type="font/woff2"
            href={href}
            crossOrigin="anonymous"
          />
        ))}
        <script type="application/ld+json">{jsonLd}</script>
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
    </>
  );
}
