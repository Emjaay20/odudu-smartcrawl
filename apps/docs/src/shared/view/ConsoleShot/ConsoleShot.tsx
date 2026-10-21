import type { ReactElement } from 'react';
import { useConsoleShot } from '@site/src/shared/usecase/useConsoleShot';
import styles from '@site/src/shared/view/ConsoleShot/ConsoleShot.module.css';

interface Props {
  readonly name: string;
  readonly alt: string;
  readonly caption: string;
  // The picture the page is waiting for: fetched first, never lazily.
  readonly priority?: boolean;
}

// One capture per colour scheme; the one that matches the page's theme shows.
export function ConsoleShot({ name, alt, caption, priority = false }: Props): ReactElement {
  const { light, dark, size } = useConsoleShot(name);
  return (
    <figure className={styles.shot}>
      <img
        className={styles.light}
        src={light}
        alt={alt}
        width={size.width}
        height={size.height}
        fetchPriority={priority ? 'high' : undefined}
        loading={priority ? undefined : 'lazy'}
      />
      <img
        className={styles.dark}
        src={dark}
        alt={alt}
        width={size.width}
        height={size.height}
        loading="lazy"
      />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
