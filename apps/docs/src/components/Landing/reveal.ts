// Content below the first screen starts low and transparent and settles as it
// comes into view. Returns a function that puts the page back, or nothing if
// the browser cannot do it. Loaded after the page is idle, so it is not in the
// first load.
export function startReveal(): (() => void) | undefined {
  const pending = [...document.querySelectorAll('[data-reveal]')].filter(
    (item) => item.getBoundingClientRect().top >= window.innerHeight,
  );
  let frame = 0;
  let observer: IntersectionObserver | undefined;
  const release = (item: Element): void => {
    item.removeAttribute('data-pending');
    observer?.unobserve(item);
  };
  const sweep = (): void => {
    frame = 0;
    for (const item of pending) {
      if (
        item.hasAttribute('data-pending') &&
        item.getBoundingClientRect().top < window.innerHeight * 0.92
      ) {
        release(item);
      }
    }
  };
  const onScroll = (): void => {
    if (frame === 0) frame = requestAnimationFrame(sweep);
  };
  try {
    for (const item of pending) item.setAttribute('data-pending', '');
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) release(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    for (const item of pending) observer.observe(item);
    // An observer reports changes only, so an item scrolled past in one jump is released here.
    window.addEventListener('scroll', onScroll, { passive: true });
  } catch {
    for (const item of pending) item.removeAttribute('data-pending');
    return undefined;
  }
  return () => {
    observer.disconnect();
    window.removeEventListener('scroll', onScroll);
    cancelAnimationFrame(frame);
    for (const item of pending) item.removeAttribute('data-pending');
  };
}
