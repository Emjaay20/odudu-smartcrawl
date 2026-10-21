import { useState } from 'react';
import { useIdle } from '@site/src/features/landing/usecase/useIdle';
import { usePrefersReducedMotion } from '@site/src/features/landing/usecase/usePrefersReducedMotion';

// Nothing changes until this has confirmed that the browser has an
// IntersectionObserver, motion is allowed and no automation is driving (a
// capture or an audit must see the page as laid out). The work itself is
// fetched once the page is idle.
export default function useReveal(): boolean {
  const [active, setActive] = useState(false);
  const reduced = usePrefersReducedMotion();
  const capable = typeof IntersectionObserver !== 'undefined' && !navigator.webdriver && !reduced;
  useIdle(capable, 200, () => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    import('@site/src/features/landing/service/revealDom').then(
      ({ startDomReveal }) => {
        if (cancelled) return;
        stop = startDomReveal({ document, window, Observer: IntersectionObserver });
        setActive(stop !== undefined);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
      stop?.();
    };
  });
  return active;
}
