export function lazily<T>(load: () => Promise<T>): { get: () => Promise<T> } {
  let fetching: Promise<T> | null = null;
  let loaded: T | null = null;
  const get = (): Promise<T> => {
    fetching ??= load().then(
      (value) => {
        loaded = value;
        return value;
      },
      (error: unknown) => {
        fetching = null;
        throw error;
      },
    );
    return fetching;
  };
  return { get: () => (loaded === null ? get() : Promise.resolve(loaded)) };
}

export const route = lazily(() => import('./constants'));
