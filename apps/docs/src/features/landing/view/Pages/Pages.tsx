import { DocsLink } from '@site/src/shared/view/DocsLink/DocsLink';
import type { ReactElement } from 'react';
import { PageShots } from '@site/src/features/landing/view/PageShots/PageShots';
import { Section } from '@site/src/features/landing/view/Section/Section';
import styles from '@site/src/features/landing/view/Pages/Pages.module.css';

export function Pages(): ReactElement {
  return (
    <Section
      id="home-pages"
      kicker="What it looks like"
      title="The pages your users see"
      section="pages"
    >
      <p className={styles.lede} data-reveal="">
        Odudu shows these pages itself, so your app builds none of them.{' '}
        <DocsLink to="/guides/sign-a-user-in/">See a sign-in end to end</DocsLink>
      </p>
      <PageShots />
    </Section>
  );
}
