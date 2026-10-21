import { useEffect, useRef } from 'react';

// Starts `run` once the page is idle, while `enabled`, and stops what it
// started when `enabled` ends or the page goes. Where the browser has no idle
// callback the start is a short timer.
export function useIdle(enabled: boolean, fallbackMs: number, run: () => () => void): void {
  const latest = useRef(run);
  useEffect(() => {
    latest.current = run;
  });
  useEffect(() => {
    if (!enabled) return undefined;
    let stop: (() => void) | undefined;
    const start = (): void => {
      stop = latest.current();
    };
    let cancel: () => void;
    if (typeof requestIdleCallback === 'function') {
      const handle = requestIdleCallback(start);
      cancel = () => {
        cancelIdleCallback(handle);
      };
    } else {
      const timer = setTimeout(start, fallbackMs);
      cancel = () => {
        clearTimeout(timer);
      };
    }
    return () => {
      cancel();
      stop?.();
    };
  }, [enabled, fallbackMs]);
}
