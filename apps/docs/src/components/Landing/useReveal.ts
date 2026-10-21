import { useEffect, useState } from 'react';

// Nothing changes until this has confirmed that the browser has an
// IntersectionObserver, motion is allowed and no automation is driving (a
// capture or an audit must see the page as laid out). The work itself is
// fetched once the page is idle.
export default function useReveal(): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (
      typeof IntersectionObserver === 'undefined' ||
      navigator.webdriver ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return undefined;
    }
    let stop: (() => void) | undefined;
    let cancelled = false;
    const run = (): void => {
      import('@site/src/components/Landing/reveal').then(
        ({ startReveal }) => {
          if (cancelled) return;
          stop = startReveal();
          setActive(stop !== undefined);
        },
        () => undefined,
      );
    };
    const handle =
      typeof requestIdleCallback === 'function' ? requestIdleCallback(run) : setTimeout(run, 200);
    return () => {
      cancelled = true;
      if (typeof requestIdleCallback === 'function') cancelIdleCallback(Number(handle));
      else clearTimeout(handle);
      stop?.();
    };
  }, []);
  return active;
}
