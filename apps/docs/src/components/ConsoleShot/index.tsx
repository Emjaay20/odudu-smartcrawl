import useBaseUrl from '@docusaurus/useBaseUrl';
import type { ReactElement } from 'react';
import manifest from '@site/static/console/manifest.json';
import styles from '@site/src/components/ConsoleShot/styles.module.css';

interface Props {
  readonly name: string;
  readonly alt: string;
  readonly caption: string;
  // The picture the page is waiting for: fetched first, never lazily.
  readonly priority?: boolean;
}

const SIZES: Readonly<Record<string, { width: number; height: number }>> = manifest;

// One capture per colour scheme; the one that matches the page's theme shows.
export default function ConsoleShot({ name, alt, caption, priority = false }: Props): ReactElement {
  const size = SIZES[name];
  if (size === undefined) throw new Error(`no console capture named ${name}`);
  const light = useBaseUrl(`/console/${name}-light.webp`);
  const dark = useBaseUrl(`/console/${name}-dark.webp`);
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
