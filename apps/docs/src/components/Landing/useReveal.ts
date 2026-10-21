import { useEffect, useState } from 'react';

// Sections and cards stay fully visible until this runs. It then switches the
// reveal on, and where the browser cannot link an animation to scrolling it
// marks each item as it enters; any failure leaves the page as it was. The
// answer goes on the page's own element, since the theme owns the html tag's classes.
export default function useReveal(): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    try {
      let seen: IntersectionObserver | undefined;
      if (!CSS.supports('animation-timeline', 'view()')) {
        if (typeof IntersectionObserver === 'undefined') return undefined;
        const observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              entry.target.setAttribute('data-revealed', '');
              observer.unobserve(entry.target);
            }
          },
          { rootMargin: '0px 0px -8% 0px' },
        );
        seen = observer;
        for (const item of document.querySelectorAll('[data-reveal]')) {
          if (item.getBoundingClientRect().top < window.innerHeight) {
            item.setAttribute('data-revealed', '');
          } else {
            observer.observe(item);
          }
        }
      }
      setActive(true);
      return () => {
        seen?.disconnect();
      };
    } catch {
      return undefined;
    }
  }, []);
  return active;
}
