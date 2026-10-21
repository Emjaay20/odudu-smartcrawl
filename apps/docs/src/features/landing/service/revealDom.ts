import {
  startReveal,
  REVEAL_MARGIN,
  type RevealHost,
  type RevealItem,
} from '@site/src/features/landing/service/reveal';

// The parts of a browser the reveal needs, handed in by whoever runs it.
export interface RevealEnv {
  readonly document: Pick<Document, 'querySelectorAll'>;
  readonly window: Pick<
    Window,
    | 'innerHeight'
    | 'addEventListener'
    | 'removeEventListener'
    | 'requestAnimationFrame'
    | 'cancelAnimationFrame'
  >;
  readonly Observer: typeof IntersectionObserver;
}

interface Marked extends RevealItem {
  readonly element: Element;
}

// The reveal over a page's `[data-reveal]` elements, held back with `data-pending`.
export function startDomReveal(env: RevealEnv): (() => void) | undefined {
  const host: RevealHost<Marked> = {
    items: () =>
      [...env.document.querySelectorAll('[data-reveal]')].map((element) => ({
        element,
        top: () => element.getBoundingClientRect().top,
        hold: () => {
          element.setAttribute('data-pending', '');
        },
        release: () => {
          element.removeAttribute('data-pending');
        },
      })),
    viewport: () => env.window.innerHeight,
    watch: (items, seen) => {
      const observer = new env.Observer(
        (entries) => {
          for (const entry of entries) {
            const item = items.find((candidate) => candidate.element === entry.target);
            if (entry.isIntersecting && item !== undefined) seen(item);
          }
        },
        { rootMargin: REVEAL_MARGIN },
      );
      for (const item of items) observer.observe(item.element);
      return () => {
        observer.disconnect();
      };
    },
    scrolled: (handler) => {
      env.window.addEventListener('scroll', handler, { passive: true });
      return () => {
        env.window.removeEventListener('scroll', handler);
      };
    },
    frame: (run) => {
      const handle = env.window.requestAnimationFrame(run);
      return () => {
        env.window.cancelAnimationFrame(handle);
      };
    },
  };
  return startReveal(host);
}
