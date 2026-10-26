import { DocsLink } from '@site/src/shared/view/DocsLink/DocsLink';
import type { ReactElement } from 'react';
import {
  AGENTS_SHIPPED,
  AGENT_ITEMS,
  PLANNED_LABEL,
  ROADMAP_NEXT,
  SHIPPED_LABEL,
} from '@site/src/features/landing/service/content';
import { useAssetUrls } from '@site/src/features/landing/usecase/useAssetUrls';
import { Chip } from '@site/src/features/landing/view/Chip/Chip';
import { Section } from '@site/src/features/landing/view/Section/Section';
import styles from '@site/src/features/landing/view/Agents/Agents.module.css';

export function Agents(): ReactElement {
  const { llms } = useAssetUrls();
  return (
    <Section
      id="home-agents"
      kicker="For AI agents"
      title="For AI agents: what works and what is planned"
      section="agents"
      tone="sunken"
    >
      <div className={styles.cards}>
        <div className={styles.pane} data-reveal="" data-shipped="">
          <h3 className={styles.title}>
            {AGENTS_SHIPPED.title}
            <Chip>{SHIPPED_LABEL}</Chip>
          </h3>
          <p className={styles.body}>
            {AGENTS_SHIPPED.before}
            <a href={llms}>{AGENTS_SHIPPED.link}</a>
            {AGENTS_SHIPPED.after}
          </p>
        </div>
        {AGENT_ITEMS.map((item) => (
          <div key={item.id} className={styles.pane} data-reveal="" data-planned={item.id}>
            <h3 className={styles.title}>
              {item.title}
              <Chip>{PLANNED_LABEL}</Chip>
            </h3>
            <p className={styles.body}>
              {item.claim} <DocsLink to={ROADMAP_NEXT}>On the roadmap</DocsLink>
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}
