import { useEffect, useRef } from 'react';

// Reads what the latest render held, for a callback that outlives the render
// it was made in: a listener, a timer, a getter registered elsewhere.
export function useLatest<T>(value: T): () => T {
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  });
  return () => latest.current;
}
