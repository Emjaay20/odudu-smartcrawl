import Link from '@docusaurus/Link';
import type { ReactElement } from 'react';
import type { Card } from '@site/src/features/landing/service/content';
import styles from '@site/src/features/landing/view/CardList/CardList.module.css';

const LAYOUTS = { 2: styles.cards2, 4: styles.cards4 } as const;

interface Props {
  cards: Card[];
  columns: 2 | 4;
}

// Each card is one link: its title is the link and stretches over the card.
export function CardList({ cards, columns }: Props): ReactElement {
  return (
    <ul className={[styles.cards, LAYOUTS[columns]].join(' ')}>
      {cards.map((card) => (
        <li key={card.to} className={styles.card} data-reveal="">
          <h3 className={styles.cardTitle}>
            <Link to={card.to} className={styles.cardLink}>
              {card.title}
            </Link>
          </h3>
          <p className={styles.cardBody}>{card.body}</p>
        </li>
      ))}
    </ul>
  );
}
