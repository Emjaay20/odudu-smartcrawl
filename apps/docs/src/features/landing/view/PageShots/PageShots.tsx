import type { ReactElement } from 'react';
import { PAGE_SHOTS, type PageShotCard } from '@site/src/features/landing/service/content';
import { usePageShot } from '@site/src/features/landing/usecase/usePageShot';
import styles from '@site/src/features/landing/view/PageShots/PageShots.module.css';

function Shot({ name, caption, alt }: PageShotCard): ReactElement {
  const { light, dark, size } = usePageShot(name);
  return (
    <figure className={styles.shot} data-reveal="">
      <img
        className={styles.light}
        src={light}
        alt={alt}
        width={size.width}
        height={size.height}
        loading="lazy"
      />
      <img
        className={styles.dark}
        src={dark}
        alt={alt}
        width={size.width}
        height={size.height}
        loading="lazy"
      />
      <figcaption className={styles.caption}>{caption}</figcaption>
    </figure>
  );
}

export function PageShots(): ReactElement {
  return (
    <div className={styles.strip} data-strip="">
      {PAGE_SHOTS.map((shot) => (
        <Shot key={shot.name} {...shot} />
      ))}
    </div>
  );
}
