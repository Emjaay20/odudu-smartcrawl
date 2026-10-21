import { useState, useSyncExternalStore } from 'react';
import { REDUCED_MOTION_QUERY } from '@site/src/features/landing/service/motion';

// Whether the reader asked for less motion; the server, which cannot know, says no.
export function usePrefersReducedMotion(): boolean {
  // One source for the life of the component, so the store is not resubscribed on each render.
  const [source] = useState(() => ({
    subscribe: (onChange: () => void): (() => void) => {
      const media = window.matchMedia(REDUCED_MOTION_QUERY);
      media.addEventListener('change', onChange);
      return () => {
        media.removeEventListener('change', onChange);
      };
    },
    snapshot: (): boolean => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    server: (): boolean => false,
  }));
  return useSyncExternalStore(source.subscribe, source.snapshot, source.server);
}
