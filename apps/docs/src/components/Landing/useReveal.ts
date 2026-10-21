import { useEffect, useState } from 'react';

// Content below the first screen starts a few pixels low and settles as it
// comes into view. Nothing changes until this has confirmed that the browser
// has an IntersectionObserver, motion is allowed and no automation is driving
// (a capture or an audit must see the page as laid out); any failure puts the
// page back as the server sent it.
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
    const pending = [...document.querySelectorAll('[data-reveal]')].filter(
      (item) => item.getBoundingClientRect().top >= window.innerHeight,
    );
    let seen: IntersectionObserver | undefined;
    try {
      for (const item of pending) item.setAttribute('data-pending', '');
      if (!CSS.supports('animation-timeline', 'view()')) {
        const observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              entry.target.removeAttribute('data-pending');
              observer.unobserve(entry.target);
            }
          },
          { rootMargin: '0px 0px -8% 0px' },
        );
        seen = observer;
        for (const item of pending) observer.observe(item);
      }
      setActive(true);
    } catch {
      for (const item of pending) item.removeAttribute('data-pending');
      return undefined;
    }
    return () => {
      seen?.disconnect();
      for (const item of pending) item.removeAttribute('data-pending');
    };
  }, []);
  return active;
}
